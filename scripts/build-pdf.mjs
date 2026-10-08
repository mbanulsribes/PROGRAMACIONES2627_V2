// Genera dist/<carpeta>/<carpeta>.pdf para cada programación. Ejecutar después de «npm run build».
// En Windows puede usarse Microsoft Edge: npm run pdf -- --channel msedge
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const slugs = fs.existsSync(dist)
  ? fs.readdirSync(dist, {withFileTypes: true}).filter(d => d.isDirectory() && d.name !== 'assets' && fs.existsSync(path.join(dist, d.name, 'index.html'))).map(d => d.name)
  : [];
if (!slugs.length) throw new Error('Genera primero la web con «npm run build».');
const i = process.argv.indexOf('--channel');
const channel = i >= 0 ? process.argv[i + 1] : undefined;

const browser = await chromium.launch({headless: true, ...(channel ? {channel} : {})});
try {
  const page = await browser.newPage();
  for (const slug of slugs) {
    await page.goto(pathToFileURL(path.join(dist, slug, 'index.html')).href, {waitUntil: 'load'});
    await page.emulateMedia({media: 'print'});
    await page.evaluate(() => document.fonts.ready);
    // Tamaño, márgenes, cabecera y pie salen del CSS (@page), como en la plantilla.
    await page.pdf({
      path: path.join(dist, slug, `${slug}.pdf`),
      preferCSSPageSize: true,
      printBackground: true,
      tagged: true,
      outline: true
    });
    console.log(`PDF: ${slug}/${slug}.pdf`);
  }
} finally {
  await browser.close();
}
