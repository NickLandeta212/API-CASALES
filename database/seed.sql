INSERT INTO torres (numero, total_departamentos)
VALUES
  (1, 68),
  (2, 68),
  (3, 68),
  (4, 68),
  (5, 64),
  (6, 64),
  (7, 64),
  (8, 36),
  (9, 32),
  (10, 32)
ON CONFLICT (numero) DO UPDATE
SET total_departamentos = EXCLUDED.total_departamentos;
