import type { APIRoute } from 'astro';
import { pages } from '../seo';

// Sitemap con alternativas de idioma (hreflang) para Google.
export const GET: APIRoute = ({ site }) => {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
  const root = site ? new URL(base, site).href : base;
  const links = (p: { es: string; en: string }) =>
    [
      `    <xhtml:link rel="alternate" hreflang="es" href="${root + p.es}"/>`,
      `    <xhtml:link rel="alternate" hreflang="en" href="${root + p.en}"/>`,
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${root + p.es}"/>`,
    ].join('\n');
  const urls = pages
    .flatMap((p) => [p.es, p.en].map((loc) => `  <url>\n    <loc>${root + loc}</loc>\n${links(p)}\n  </url>`))
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
