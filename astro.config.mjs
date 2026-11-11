// @ts-check
import { defineConfig } from 'astro/config';

// SITE_URL y BASE_PATH se definen en el deploy (GitHub Actions).
// Con dominio propio: SITE_URL=https://devdesdecero.com y BASE_PATH=/
export default defineConfig({
  site: process.env.SITE_URL || 'https://devdesdeceromx.github.io',
  base: process.env.BASE_PATH || '/',
  trailingSlash: 'ignore',
  // CSS en línea: evita una petición que bloquea el primer pintado.
  build: { inlineStylesheets: 'always' },
});
