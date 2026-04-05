# Conjunto App

Monorepo separado por responsabilidades:

- backend: API REST Node.js + Express
- database: scripts SQL (schema y seed) para PostgreSQL
- frontend: app React (Vite)

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

## Estructura

- database/schema.sql
- database/seed.sql
- backend/src
- frontend/src
