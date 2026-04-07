# Conjunto App

Monorepo separado por responsabilidades:

- backend: API REST Node.js + Express
- database: scripts SQL (schema y seed) para PostgreSQL
- frontend: app React (Vite)
- electron: app de escritorio Electron que consume la API central

## Flujo recomendado

1. Backend:
   - cd backend
   - npm install
   - npm run db:init
   - npm start

2. Frontend:
   - cd frontend
   - npm install
   - copia .env.example a .env
   - npm run dev

3. Desktop online:
   - define `DESKTOP_API_BASE_URL` y `DESKTOP_PUBLIC_APP_URL`
   - ejecuta `npm run desktop:dist`

## Estructura

- database/schema.sql
- database/seed.sql
- backend/src
- frontend/src
