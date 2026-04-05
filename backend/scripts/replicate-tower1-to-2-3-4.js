const { pool } = require('../src/config/database');

async function run() {
  const torresResult = await pool.query(
    'SELECT id, numero FROM torres WHERE numero IN (1, 2, 3, 4) ORDER BY numero ASC'
  );

  const torreByNumero = new Map(torresResult.rows.map((row) => [Number(row.numero), Number(row.id)]));
  const sourceTorreId = torreByNumero.get(1);

  if (!sourceTorreId) {
    throw new Error('No existe la torre 1 en la base de datos');
  }

  const sourceRows = await pool.query(
    'SELECT numero FROM departamentos WHERE torre_id = $1 ORDER BY id ASC',
    [sourceTorreId]
  );

  if (sourceRows.rowCount === 0) {
    throw new Error('La torre 1 no tiene departamentos para replicar');
  }

  for (const targetNumero of [2, 3, 4]) {
    const targetTorreId = torreByNumero.get(targetNumero);
    if (!targetTorreId) continue;

    for (const row of sourceRows.rows) {
      const nextNumero = String(row.numero).replace(/^T1/, `T${targetNumero}`);

      await pool.query(
        `INSERT INTO departamentos (torre_id, numero, usuario_id)
         VALUES ($1, $2, NULL)
         ON CONFLICT (torre_id, numero) DO NOTHING`,
        [targetTorreId, nextNumero]
      );
    }
  }

  const result = await pool.query(
    `SELECT t.numero AS torre, COUNT(d.id)::int AS total_departamentos
     FROM torres t
     LEFT JOIN departamentos d ON d.torre_id = t.id
     WHERE t.numero IN (1, 2, 3, 4)
     GROUP BY t.numero
     ORDER BY t.numero`
  );

  console.log('Totales por torre (1-4):');
  console.table(result.rows);
}

run()
  .catch((error) => {
    console.error('Error al replicar departamentos:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
