# Electron Base (Windows exe)

Esta carpeta contiene la base de escritorio para Conjunto App.

## Modo desarrollo

Desde la raiz del proyecto:

```bash
npm run desktop:dev
```

Esto levanta:
- backend en modo watch
- frontend Vite
- Electron apuntando a http://localhost:5173

## Generar instalador .exe

Desde la raiz del proyecto:

```bash
npm run desktop:dist
```

Salida esperada:
- carpeta `dist-electron/`
- instalador NSIS para Windows (`Conjunto-App-Setup-<version>.exe`)
- icono personalizado generado automaticamente desde `frontend/src/assets/casales-san-pedro-logo.svg`

## Notas importantes

- En build empaquetado, Electron inicia automaticamente el backend interno.
- Asegurate de tener configurado `backend/.env` (o variables de entorno del sistema) con al menos:
  - `DATABASE_URL`
  - `JWT_SECRET`
  - `PUBLIC_APP_URL` (si usas URL publica para QR)
- Si apuntas a una base remota, verifica conectividad de red desde el equipo final.
