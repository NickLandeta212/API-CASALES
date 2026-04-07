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

La version de escritorio ya no embebe un backend local. Todas las PCs deben apuntar a una API central desplegada en linea y a una URL publica unica para el QR.

Antes de generar el instalador, define las variables para embebidas en el desktop:

```powershell
$env:DESKTOP_API_BASE_URL="https://api.tu-dominio.com"
$env:DESKTOP_PUBLIC_APP_URL="https://app.tu-dominio.com"
```

Si quieres reutilizar valores ya guardados, el build toma la configuracion previa de `electron/assets/desktop-config.json`.

Desde la raiz del proyecto:

```bash
npm run desktop:dist
```

Salida esperada:
- carpeta `dist-electron/`
- instalador NSIS para Windows (`Conjunto-App-Setup-<version>.exe`)
- icono personalizado generado automaticamente desde `frontend/src/assets/casales-san-pedro-logo.svg`
- configuracion online embebida automaticamente en `electron/assets/desktop-config.json`

## Notas importantes

- El .exe ya no levanta un backend interno; solo consume la API central configurada.
- Todas las PCs deben usar la misma `DESKTOP_API_BASE_URL` para que los datos se sincronicen entre dispositivos.
- `DESKTOP_PUBLIC_APP_URL` se usa para generar los QR publicos de reservas.
- Si la app arranca sin configuracion valida, muestra error y se cierra para evitar un estado parcial.
- La configuracion local del equipo destino se guarda en `%APPDATA%/Conjunto App/desktop-config.json` y puede sobreescribir la configuracion embebida.
