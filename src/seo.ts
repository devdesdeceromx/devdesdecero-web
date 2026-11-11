// Páginas públicas del sitio y su versión en el otro idioma.
// Se usa para el sitemap y para las etiquetas canonical/hreflang.
// El panel /admin no aparece aquí a propósito (no se indexa).
export const pages: { es: string; en: string }[] = [
  { es: '', en: 'en/' },
  { es: 'privacidad/', en: 'en/privacy/' },
  { es: 'terminos/', en: 'en/terms/' },
];

// Código de verificación de Google Search Console (meta tag).
// Se define en el deploy (GitHub Actions); vacío = no se imprime la etiqueta.
export const googleVerification = import.meta.env.PUBLIC_GOOGLE_SITE_VERIFICATION ?? '';
