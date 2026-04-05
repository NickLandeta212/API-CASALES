const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/database');

const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin General';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@conjunto.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123*';
const ADMIN_ROLE = process.env.ADMIN_ROLE || 'admin_general';

async function run() {
  const allowedRoles = ['admin_general', 'admin_conjunto'];

  if (!allowedRoles.includes(ADMIN_ROLE)) {
    throw new Error('ADMIN_ROLE invalido. Usa admin_general o admin_conjunto');
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const result = await pool.query(
    `INSERT INTO usuarios (nombre, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email)
     DO UPDATE
       SET nombre = EXCLUDED.nombre,
           password_hash = EXCLUDED.password_hash,
           role = EXCLUDED.role
     RETURNING id, nombre, email, role`,
    [ADMIN_NAME, ADMIN_EMAIL, passwordHash, ADMIN_ROLE]
  );

  console.log('Usuario administrador listo');
  console.log(result.rows[0]);
}

run()
  .catch((error) => {
    console.error('Error al crear admin:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
