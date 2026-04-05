const { pool } = require('../src/config/database');

async function run() {
  const torresResult = await pool.query(
    'SELECT id, numero FROM torres WHERE numero IN (8, 9, 10) ORDER BY numero ASC'
  );

  const torreByNumero = new Map(torresResult.rows.map((row) => [Number(row.numero), Number(row.id)]));
  const sourceTorreId = torreByNumero.get(8);

  if (!sourceTorreId) {
    throw new Error('No existe la torre 8 en la base de datos');
  }

  const sourceRows = await pool.query(
    `SELECT numero
     FROM departamentos
     WHERE torre_id = $1
       AND numero !~ '^T8SS'
     ORDER BY id ASC`,
    [sourceTorreId]
  );

  if (sourceRows.rowCount === 0) {
    throw new Error('La torre 8 no tiene departamentos PB/D para replicar');
  }

  for (const targetNumero of [9, 10]) {
    const targetTorreId = torreByNumero.get(targetNumero);
    if (!targetTorreId) continue;

    for (const row of sourceRows.rows) {
      const nextNumero = String(row.numero).replace(/^T8/, `T${targetNumero}`);

      await pool.query(
        `INSERT INTO departamentos (torre_id, numero, usuario_id)
         VALUES ($1, $2, NULL)
         ON CONFLICT (torre_id, numero) DO NOTHING`,
        [targetTorreId, nextNumero]
      );
    }
  }

  const totals = await pool.query(
    `SELECT t.numero AS torre,
            COUNT(d.id)::int AS total_departamentos,
            COUNT(*) FILTER (WHERE d.numero ~ '^T[0-9]+SS')::int AS total_ss
     FROM torres t
     LEFT JOIN departamentos d ON d.torre_id = t.id
     WHERE t.numero IN (8, 9, 10)
     GROUP BY t.numero
     ORDER BY t.numero`
  );

  console.log('Totales por torre (8,9,10):');
  console.table(totals.rows);
}

run()
  .catch((error) => {
    console.error('Error al replicar departamentos de torre 8:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
