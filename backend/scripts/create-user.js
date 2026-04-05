const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/database');

const USER_NAME = process.env.USER_NAME || 'Usuario Sistema';
const USER_LOGIN = process.env.USER_LOGIN || process.env.USER_EMAIL;
const USER_PASSWORD = process.env.USER_PASSWORD;
const USER_ROLE = process.env.USER_ROLE || 'condomino';

async function run() {
  const allowedRoles = ['admin_general', 'admin_conjunto', 'condomino'];

  if (!USER_LOGIN || !USER_PASSWORD) {
    throw new Error('USER_LOGIN (o USER_EMAIL) y USER_PASSWORD son obligatorios');
  }

  if (!allowedRoles.includes(USER_ROLE)) {
    throw new Error('USER_ROLE invalido. Usa admin_general, admin_conjunto o condomino');
  }

  const passwordHash = await bcrypt.hash(USER_PASSWORD, 10);

  const result = await pool.query(
    `INSERT INTO usuarios (nombre, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email)
     DO UPDATE
       SET nombre = EXCLUDED.nombre,
           password_hash = EXCLUDED.password_hash,
           role = EXCLUDED.role
     RETURNING id, nombre, email, role`,
    [USER_NAME, String(USER_LOGIN).trim().toLowerCase(), passwordHash, USER_ROLE]
  );

  console.log('Usuario creado o actualizado');
  console.log(result.rows[0]);
}

run()
  .catch((error) => {
    console.error('Error al crear usuario:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
