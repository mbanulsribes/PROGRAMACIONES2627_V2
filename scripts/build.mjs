// Genera la web: una página por programación (programaciones/<carpeta>/index.adoc)
// y una portada que las enlaza todas.
import fs from 'node:fs';
import path from 'node:path';
import Asciidoctor from '@asciidoctor/core';

const root = path.resolve(import.meta.dirname, '..');
const src = path.join(root, 'programaciones');
const out = path.join(root, 'dist');
const processor = Asciidoctor();
const logger = processor.MemoryLogger.create();
processor.LoggerManager.setLogger(logger);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

fs.rmSync(out, {recursive: true, force: true});
fs.mkdirSync(out, {recursive: true});
fs.cpSync(path.join(root, 'assets'), path.join(out, 'assets'), {recursive: true});

const slugs = fs.readdirSync(src, {withFileTypes: true})
  .filter(d => d.isDirectory() && fs.existsSync(path.join(src, d.name, 'index.adoc')))
  .map(d => d.name);
if (!slugs.length) throw new Error('No hay ninguna programación en programaciones/<carpeta>/index.adoc');

const items = [];
for (const slug of slugs) {
  const dir = path.join(src, slug);
  const source = fs.readFileSync(path.join(dir, 'index.adoc'), 'utf8');
  const doc = processor.load(source, {
    safe: 'safe',
    standalone: true,
    base_dir: dir,
    attributes: {linkcss: '', stylesdir: '../assets', stylesheet: 'programacion.css', nofooter: ''}
  });
  const pdf = `${slug}.pdf`;
  const borrador = doc.hasAttribute('borrador');
  const barra = `<nav class="barra"><a href="../index.html">← Todas las programaciones</a>${borrador ? '<span class="sello">En preparación</span>' : ''}<span class="hueco"></span><a href="${pdf}" download>Descargar PDF</a><button type="button" onclick="window.print()">Imprimir</button></nav>`;
  const pie = `<footer class="pie"><span>${esc(doc.getAttribute('modulo') || doc.getDocumentTitle())} · Curso ${esc(doc.getAttribute('curso'))}</span><a href="index.adoc" download>Fuente AsciiDoc</a></footer>`;
  const html = doc.convert()
    .replace(/<body([^>]*)>/, `<body$1>\n${barra}`)
    .replace('</body>', `${pie}\n</body>`);
  const target = path.join(out, slug);
  fs.mkdirSync(target, {recursive: true});
  // Imágenes u otros recursos que acompañen a la programación.
  fs.cpSync(dir, target, {recursive: true});
  fs.writeFileSync(path.join(target, 'index.html'), html);
  items.push({
    slug, pdf,
    titulo: doc.getAttribute('titulo-corto') || doc.getDocumentTitle(),
    etapa: doc.getAttribute('etapa') || '',
    resumen: doc.getAttribute('resumen') || doc.getAttribute('description') || '',
    orden: Number(doc.getAttribute('orden') || 99),
    borrador
  });
}
items.sort((a, b) => a.orden - b.orden || a.titulo.localeCompare(b.titulo, 'es'));

const curso = '2026-2027';
const tarjetas = items.map(i => `<li class="tarjeta${i.borrador ? ' borrador' : ''}"><span class="etapa">${esc(i.etapa)}${i.borrador ? ' <span class="sello">En preparación</span>' : ''}</span><h2><a href="${i.slug}/index.html">${esc(i.titulo)}</a></h2><p>${esc(i.resumen)}</p><p class="acciones"><a href="${i.slug}/index.html">Ver en la web</a><a href="${i.slug}/${i.pdf}" download>PDF</a></p></li>`).join('\n');
const portada = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Programaciones didácticas ${curso} · IES Font de Sant Lluís</title>
<meta name="description" content="Programaciones didácticas del curso ${curso}.">
<link rel="stylesheet" href="assets/programacion.css"></head>
<body class="portada-web"><main class="indice">
<p class="antetitulo">IES Font de Sant Lluís · Curso ${curso}</p>
<h1>Programaciones didácticas</h1>
<p class="entradilla">Cada programación puede consultarse en la web, descargarse en PDF o imprimirse.</p>
<ul class="tarjetas">
${tarjetas}
</ul>
<footer class="pie"><span>Profesora: María Bañuls Ribes</span></footer>
</main></body></html>`;
fs.writeFileSync(path.join(out, 'index.html'), portada);
fs.writeFileSync(path.join(out, '.nojekyll'), '');

const messages = logger.getMessages();
for (const m of messages) console.warn(`[${m.getSeverity()}] ${m.getText()}`);
if (messages.some(m => ['ERROR', 'FATAL'].includes(m.getSeverity()))) process.exit(1);
console.log(`Generadas ${items.length} programaciones: ${items.map(i => i.slug).join(', ')}.`);
