const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const pngToIco = require('png-to-ico');

async function run() {
  const sourceSvg = path.resolve(__dirname, '../../frontend/src/assets/casales-san-pedro-logo.svg');
  const assetsDir = path.resolve(__dirname, '../assets');
  const pngPath = path.join(assetsDir, 'icon-256.png');
  const icoPath = path.join(assetsDir, 'icon.ico');

  if (!fs.existsSync(sourceSvg)) {
    throw new Error(`No se encontro el logo fuente: ${sourceSvg}`);
  }

  fs.mkdirSync(assetsDir, { recursive: true });

  await sharp(sourceSvg)
    .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(pngPath);

  const icoBuffer = await pngToIco(pngPath);
  fs.writeFileSync(icoPath, icoBuffer);

  console.log(`Icono generado: ${icoPath}`);
}

run().catch((error) => {
  console.error('No se pudo generar el icono:', error.message);
  process.exit(1);
});
