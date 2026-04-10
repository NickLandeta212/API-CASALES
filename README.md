# Conjunto App

Monorepo separado por responsabilidades:

- backend: API REST Node.js + Express
- database: scripts SQL (schema y seed) para PostgreSQL
- frontend: app React (Vite)

## Enfoque actual (Web)

El flujo principal del proyecto ahora es web: una sola API central + frontend web.

## Desarrollo local rapido

1. Instalar dependencias de backend y frontend:
   - npm --prefix backend install
   - npm --prefix frontend install

2. Crear archivo de entorno del backend:
   - copia backend/.env.example a backend/.env
   - configura DATABASE_URL y JWT_SECRET

3. Levantar API + frontend:
   - npm run web:dev

4. Abrir en navegador:
   - frontend: http://localhost:5173
   - api: http://localhost:3000

## Produccion web

Modo recomendado: desplegar este repositorio como un solo servicio Node.js.

1. Build command: `npm install && npm run build`
2. Start command: `npm start`
3. Variables de entorno requeridas:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `PGSSL=true` (si usas Supabase)
4. Variables recomendadas:
   - `CORS_ORIGIN=https://tu-dominio.com`
   - `PUBLIC_APP_URL=https://tu-dominio.com`

En produccion, el backend sirve automaticamente `frontend/dist` y mantiene las rutas API.

Seguridad de red:

- El unico puerto publico debe ser el HTTP/HTTPS de la app.
- La base de datos no se expone como puerto publico del proyecto; solo se usa por variables secretas de entorno.
- Si usas Supabase, la conexion va por `DATABASE_URL` y no necesitas abrir puertos de PostgreSQL en tu servidor web.

Flujo simple de publicacion:

1. Sube el repo a GitHub.
2. Crea el servicio en Render usando `render.yaml`.
3. Pega las variables de entorno.
4. Publica.

## Healthcheck

- `GET /health` devuelve `{ "ok": true }`

## Estructura

- database/schema.sql
- database/seed.sql
- backend/src
- frontend/src
