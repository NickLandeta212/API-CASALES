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

La version de escritorio vuelve a incluir el backend dentro del instalador. Eso permite probarlo en otra PC sin depender de una API publica externa, usando la base de datos de Supabase que ya configuraste.

Antes de generar el instalador, define opcionalmente la URL publica del QR si ya tienes una web para abrir desde el celular:

```powershell
$env:DESKTOP_PUBLIC_APP_URL="https://app.tu-dominio.com"
```

Si no defines nada, el instalador usa la configuracion local por defecto y el backend embebido.

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

- El .exe levanta un backend interno y se conecta a la base de datos embebida del instalador.
- `DESKTOP_PUBLIC_APP_URL` se usa para generar los QR publicos de reservas y puede quedar vacio si solo quieres que el desktop abra.
- Si la app arranca sin configuracion valida, muestra error y se cierra para evitar un estado parcial.
- La configuracion local del equipo destino se guarda en `%APPDATA%/Conjunto App/desktop-config.json` y puede sobreescribir la configuracion embebida.
