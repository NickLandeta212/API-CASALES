CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(30) NOT NULL CHECK (role IN ('admin_general', 'admin_conjunto', 'condomino')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS torres (
  id SERIAL PRIMARY KEY,
  numero INTEGER NOT NULL UNIQUE,
  total_departamentos INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS departamentos (
  id SERIAL PRIMARY KEY,
  torre_id INTEGER NOT NULL REFERENCES torres(id) ON DELETE CASCADE,
  numero VARCHAR(30) NOT NULL,
  usuario_id INTEGER UNIQUE REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (torre_id, numero)
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'departamentos'
      AND column_name = 'numero'
      AND data_type IN ('integer', 'bigint', 'smallint')
  ) THEN
    ALTER TABLE departamentos
      ALTER COLUMN numero TYPE VARCHAR(30)
      USING numero::VARCHAR(30);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS personas (
  id SERIAL PRIMARY KEY,
  departamento_id INTEGER NOT NULL REFERENCES departamentos(id) ON DELETE CASCADE,
  nombres VARCHAR(120) NOT NULL,
  apellidos VARCHAR(120) NOT NULL,
  documento VARCHAR(50) NOT NULL,
  telefono VARCHAR(30),
  tipo_ocupacion VARCHAR(20) NOT NULL DEFAULT 'dueno' CHECK (tipo_ocupacion IN ('dueno', 'arrendatario')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reservas (
  id SERIAL PRIMARY KEY,
  departamento_id INTEGER NOT NULL REFERENCES departamentos(id) ON DELETE CASCADE,
  fecha DATE NOT NULL UNIQUE,
  estado VARCHAR(20) NOT NULL DEFAULT 'disponible' CHECK (estado IN ('disponible', 'en_proceso', 'reservado')),
  observaciones TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
