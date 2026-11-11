// Política de seguridad del navegador (CSP) para GitHub Pages.
// GitHub Pages no permite cabeceras HTTP propias, así que se manda como <meta>.
// Limita de dónde se cargan scripts, estilos, fuentes y a qué servidores se conecta la página.
export function contentSecurityPolicy(supabaseUrl: string) {
  let api = '';
  try {
    const u = new URL(supabaseUrl);
    api = `${u.origin} wss://${u.host}`;
  } catch {}
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    `connect-src 'self' ${api}`.trim(),
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ].join('; ');
}
