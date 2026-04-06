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

Antes de generar el instalador, define las variables para embebidas en el backend desktop:

```powershell
$env:DESKTOP_DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DBNAME"
$env:DESKTOP_JWT_SECRET="TU_SECRETO_LARGO_Y_FUERTE"
$env:DESKTOP_CORS_ORIGIN="*"
$env:DESKTOP_PUBLIC_APP_URL="https://tu-dominio-publico.com"
```

Nota: desde ahora, si no defines estas variables en la terminal, el build reutiliza automaticamente lo que ya exista en `backend/.env.desktop`.

Desde la raiz del proyecto:

```bash
npm run desktop:dist
```

Salida esperada:
- carpeta `dist-electron/`
- instalador NSIS para Windows (`Conjunto-App-Setup-<version>.exe`)
- icono personalizado generado automaticamente desde `frontend/src/assets/casales-san-pedro-logo.svg`
- configuracion backend embebida automaticamente en `backend/.env.desktop`

## Notas importantes

- En build empaquetado, Electron inicia automaticamente el backend interno.
- El instalador final ya lleva configurado el backend con `DESKTOP_DATABASE_URL` y `DESKTOP_JWT_SECRET` (sin editar nada en la laptop destino).
- Si `backend/.env.desktop` tiene `DATABASE_URL` y `JWT_SECRET` validos al momento de empaquetar, el .exe abre directo y llega al login sin pedir configuracion manual.
- La ventana de configuracion inicial fue removida del ejecutable: el arranque es automatico.
- Si la configuracion embebida no existe o falla, la app muestra error y se cierra para evitar arranques incompletos.
- La configuracion local del equipo destino se guarda en `%APPDATA%/Conjunto App/desktop-config.json`.
- Si apuntas a una base remota, verifica conectividad de red desde el equipo final.
