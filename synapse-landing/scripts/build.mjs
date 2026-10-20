import { mkdir, cp, readdir, writeFile, unlink } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
await mkdir(dist, { recursive: true });
for (const file of ['robots.txt', 'sitemap.xml']) {
  await unlink(join(dist, file)).catch((error) => { if (error.code !== 'ENOENT') throw error; });
}
for (const entry of ['index.html', 'styles.css', 'app.js', 'assets', 'legal']) {
  await cp(join(root, entry), join(dist, entry), { recursive: true });
}
// A relative OG image works locally. Set SITE_URL to emit a canonical, absolute
// social image and sitemap once the final public domain has been confirmed.
const siteUrl = process.env.SITE_URL;
if (siteUrl) {
  const url = new URL(siteUrl);
  if (!['http:', 'https:'].includes(url.protocol) || url.search || url.hash || url.username || url.password) {
    throw new Error('SITE_URL debe ser una URL HTTP(S) sin credenciales, query ni fragmento.');
  }
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  const { readFile } = await import('node:fs/promises');
  const escape = (value) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const html = (await readFile(join(dist, 'index.html'), 'utf8'))
    .replace('content="./assets/synapse-brand.webp"', `content="${escape(new URL('assets/synapse-brand.webp', url).href)}"`)
    .replace('</head>', `  <link rel="canonical" href="${escape(url.href)}">\n  <meta property="og:url" content="${escape(url.href)}">\n</head>`);
  await writeFile(join(dist, 'index.html'), html);
  await writeFile(join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${escape(url.href)}</loc></url></urlset>\n`);
  await writeFile(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${new URL('sitemap.xml', url).href}\n`);
}
async function count(directory) {
  let files = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    files += entry.isDirectory() ? await count(join(directory, entry.name)) : 1;
  }
  return files;
}
console.log(`Landing lista: ${dist} (${await count(dist)} archivos).`);
if (!siteUrl) console.log('Dominio final pendiente: configure SITE_URL al publicar para canonical, sitemap y Open Graph absoluto.');
