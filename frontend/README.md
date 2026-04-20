# Frontend Conjunto App

Aplicacion React + Vite que consume la API del backend.

## Desarrollo local

1. Instalar dependencias:
	- npm install

2. Configurar variable opcional de API en frontend/.env:

```env
VITE_API_URL=http://localhost:3000
```

3. Ejecutar en desarrollo:
	- npm run dev

## Build

- npm run build
- npm run preview

## Produccion

- Publica el build generado en `frontend/dist`.
- Define `VITE_API_URL` con la URL publica del backend.
- Si frontend y API comparten dominio, el cliente usa fallback al mismo origen.
