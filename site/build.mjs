/* OLGA — сборка статического сайта из content/site.json.
   Выход: dist/index.html + dist/assets/*. Медиа лежит в dist/media/.
   Запуск: node build.mjs   (без зависимостей) */
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as T from './src/templates.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const d = JSON.parse(await readFile(join(root, 'content/site.json'), 'utf8'));

const css = (await Promise.all(
  ['tokens.css', 'base.css', 'sections.css'].map(f => readFile(join(root, 'src/styles', f), 'utf8'))
)).join('\n');
const js = await readFile(join(root, 'src/js/app.js'), 'utf8');

await mkdir(join(root, 'dist/assets'), { recursive: true });
await writeFile(join(root, 'dist/assets/app.css'), css);
await writeFile(join(root, 'dist/assets/app.js'), js);

/* Разметка организации — для поиска и карточек */
const ld = {
  '@context': 'https://schema.org',
  '@type': 'FurnitureStore',
  name: d.meta.brand,
  description: d.meta.description,
  telephone: d.contacts.phone,
  email: d.contacts.email,
  address: { '@type': 'PostalAddress', streetAddress: d.contacts.showroom, addressCountry: 'RU' },
  openingHours: d.contacts.hours,
  image: d.meta.og,
  url: d.meta.url
};

const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${T.esc(d.meta.title)}</title>
<meta name="description" content="${T.esc(d.meta.description)}">
<meta name="theme-color" content="#0B0A09">
<link rel="preconnect" href="https://images.unsplash.com" crossorigin>
<link rel="dns-prefetch" href="https://images.unsplash.com">
<meta property="og:type" content="website">
<meta property="og:title" content="${T.esc(d.meta.title)}">
<meta property="og:description" content="${T.esc(d.meta.description)}">
<meta property="og:image" content="${T.esc(d.meta.og)}">
<meta property="og:locale" content="${T.esc(d.meta.locale)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%230B0A09'/%3E%3Ctext x='16' y='22' font-family='Georgia,serif' font-size='17' font-weight='600' fill='%23B8894A' text-anchor='middle'%3EO%3C/text%3E%3C/svg%3E">
<link rel="canonical" href="${T.esc(d.meta.url)}">
<link rel="preload" as="image" href="${T.esc(d.hero.frames.pattern.replace('{i}', '00'))}" fetchpriority="high">
<link rel="preload" as="font" type="font/woff2" href="assets/fonts/inter-tight-500-cyrillic.woff2" crossorigin>
<link rel="preload" as="font" type="font/woff2" href="assets/fonts/inter-400-cyrillic.woff2" crossorigin>
<link rel="stylesheet" href="assets/fonts.css">
<link rel="stylesheet" href="assets/app.css">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body>
<a class="skip" href="#catalog">К содержанию</a>
${T.header(d)}
<main>
${T.hero(d)}
${T.usp(d)}
${T.catalog(d)}
${T.projects(d)}
${T.caseStudy(d)}
${T.calculator(d)}
${T.quiz(d)}
${T.materials(d)}
${T.details(d)}
${T.production(d)}
${T.quality(d)}
${T.reviews(d)}
${T.process(d)}
${T.ctaMeasure(d)}
${T.contacts(d)}
</main>
${T.footer(d)}
${T.sheet(d)}
<script src="assets/app.js" defer></script>
</body>
</html>
`;

await writeFile(join(root, 'dist/index.html'), html);

const base = d.meta.url.replace(/\/$/, '');
await writeFile(join(root, 'dist/robots.txt'),
  `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);
await writeFile(join(root, 'dist/sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  `  <url><loc>${base}/</loc><changefreq>monthly</changefreq><priority>1.0</priority></url>\n</urlset>\n`);

console.log(`built dist/index.html — ${(html.length / 1024).toFixed(1)} KB`);
