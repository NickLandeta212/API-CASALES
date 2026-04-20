const { Pool } = require('pg');
require('dotenv').config({ override: true });

const hasExplicitPgConfig = Boolean(
  process.env.PGHOST ||
  process.env.PGPORT ||
  process.env.PGUSER ||
  process.env.PGPASSWORD ||
  process.env.PGDATABASE
);

function shouldUseSslForUrl(url) {
  const sslMode = String(url.searchParams.get('sslmode') || '').toLowerCase();

  return (
    process.env.PGSSL === 'true'
    || sslMode === 'require'
    || sslMode === 'verify-full'
    || url.hostname.endsWith('.supabase.co')
  );
}

function buildPoolConfig() {
  if (!hasExplicitPgConfig && process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    const ssl = shouldUseSslForUrl(url)
      ? { rejectUnauthorized: false }
      : false;

    return {
      connectionString: process.env.DATABASE_URL,
      host: url.hostname,
      port: Number(url.port) || 5432,
      user: decodeURIComponent(url.username || process.env.PGUSER || 'postgres'),
      password: decodeURIComponent(url.password || process.env.PGPASSWORD || ''),
      database: decodeURIComponent((url.pathname || '').replace(/^\//, '')) || process.env.PGDATABASE || 'conjunto_app',
      ssl,
    };
  }

  const explicitConnectionString = process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {};
  const explicitSsl = process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false;

  return {
    ...explicitConnectionString,
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT) || 5432,
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || '',
    database: process.env.PGDATABASE || 'conjunto_app',
    ssl: explicitSsl,
  };
}

const pool = new Pool(buildPoolConfig());

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL error', error);
});

module.exports = { pool };
