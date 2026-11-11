export type Lang = 'es' | 'en';

const es = {
  meta: {
    title: 'DevDesdeCero · Planeación, diseño y desarrollo web',
    description: 'Sitios web que se ven premium, cargan al instante y convierten visitas en clientes. Planeación, diseño y desarrollo web en español e inglés.',
  },
  nav: { main: 'Principal', home: 'DevDesdeCero inicio', approach: 'Enfoque', work: 'Proyectos', services: 'Servicios', process: 'Proceso', talk: 'Hablemos', open: 'Abrir menú', close: 'Cerrar menú', skip: 'Saltar al contenido', lang: 'Change language to English' },
  hero: { a: 'Desde', b: 'cero.', c: 'Hasta increíble.', sub: 'Planeación, diseño y desarrollo de sitios web que se ven premium, cargan al instante y convierten visitas en clientes.', cta: 'Cuéntame tu proyecto', more: 'Ver proyectos', shot: 'Página de inicio de Radio Emmanuel' },
  manifest: { text: 'Cada sitio empieza con una página en blanco. Planeo la estrategia, diseño cada detalle y lo construyo para que sea rápido, claro y tuyo.', accent: ['rápido,', 'claro', 'tuyo.'] },
  details: {
    h: ['Hecho con obsesión', 'por los detalles.'],
    lede: 'Lo que no se ve también importa: velocidad, accesibilidad y buen posicionamiento desde el primer día.',
    perf: ['Rendimiento', 'Meta de calificación en Google Lighthouse para cada sitio que entrego.', 'Calificación 100'],
    mobile: ['Primero el celular', 'La mayoría de tus clientes te verán en su teléfono. Ahí empieza el diseño.'],
    seo: ['Te encuentran', 'SEO técnico incluido.', 'Tu negocio, primero en Google', 'Estructura, velocidad y contenido pensados para buscadores.'],
    edit: ['Tú tienes el control', 'Editas textos e imágenes sin depender de nadie.', 'Nuevo horario'],
    honest: ['Sin promesas vacías', 'Fechas realistas acordadas contigo y avances que puedes ver en cada etapa.'],
  },
  pide: {
    lede: 'La nueva forma de pedir a los negocios de Nuevo Progreso desde el celular. Su página de lanzamiento ya está recibiendo negocios en lista de espera.',
    live: 'Ver sitio en vivo', shot: 'PideProgreso en un celular',
    meta: [['Nuevo Progreso', 'Tamaulipas, México'], ['Móvil primero', 'diseñado para el celular'], ['En vivo', 'lista de espera abierta']],
  },
  radio: {
    lede: 'Radio cristiana en vivo desde Edinburg, Texas, para el mundo entero. Reproductor siempre visible, programación del día, peticiones de cantos y app instalable, en español e inglés.',
    meta: [['24/7', 'transmisión en vivo'], ['ES · EN', 'sitio bilingüe'], ['App', 'instalable en el celular']],
  },
  giros: {
    h: ['Pensado para', 'tu tipo de negocio.'],
    lede: 'El mismo objetivo, más confianza y más clientes, con un sitio armado alrededor de lo que tu negocio ofrece.',
    items: [
      ['Dentistas y clínicas', 'Tratamientos, credenciales, ubicación y citas, con información clara para pacientes que vienen de otro país.'],
      ['Spas y estética', 'Servicios con buenas fotos, paquetes y reservaciones, en una presencia que transmite cuidado.'],
      ['Salones de belleza', 'Portafolio, precios y agenda para convertir la inspiración en citas.'],
      ['Farmacias y comercios', 'Horarios, ubicación, contacto rápido y respuestas a las preguntas de siempre.'],
    ],
    more: '¿Tu negocio es de otro giro? Cuéntame de qué se trata',
  },
  services: {
    h: '¿Cuál es para ti?',
    lede: 'Tres paquetes con alcance claro. El precio lo platicamos según lo que necesitas.',
    price: 'Precio según tu proyecto', choose: 'Elegir', recommended: 'Recomendado',
    plans: [
      { name: 'Esencial', items: [['Landing page', 'Una página larga a medida'], ['Fecha acordada', 'Según tu proyecto'], ['WhatsApp y formulario', 'Para recibir contactos']] },
      { name: 'Profesional', items: [['4 a 6 páginas', 'Inicio, servicios, nosotros y más'], ['Revisiones', 'En cada etapa'], ['Contenido editable', 'Tú actualizas tu sitio']] },
      { name: 'A medida', items: [['Tienda, reservas, streaming', 'Funciones especiales'], ['Plan por etapas', 'Según el alcance'], ['Soporte continuo', 'Mantenimiento mensual']] },
    ],
  },
  process: {
    h: ['Cuatro pasos.', 'Cero sorpresas.'],
    steps: [
      ['Descubrir', 'Una llamada para entender tu negocio, tus clientes y tus metas.'],
      ['Planear', 'Mapa del sitio, contenido de cada página y prioridades.'],
      ['Diseñar', 'Prototipo navegable en escritorio y celular, antes de programar.'],
      ['Lanzar', 'Desarrollo, pruebas, dominio y publicación. Te enseño a editarlo.'],
    ],
  },
  final: { h: ['Tu próximo sitio', 'empieza aquí.'], lede: 'Cuéntame tu idea en dos minutos. La primera plática es para entenderte: sin compromiso y sin tecnicismos.' },
  form: {
    need: '¿Qué necesitas?',
    types: [['Landing page', 'Landing page'], ['Sitio completo', 'Sitio completo'], ['A medida', 'Tienda o a medida'], ['Rediseño', 'Rediseño'], ['No sé', 'Aún no sé']],
    name: 'Tu nombre', email: 'Correo electrónico', phone: 'Teléfono (opcional)', business: 'Negocio o sitio actual (opcional)', message: 'Cuéntame tu idea',
    hp: 'No llenes este campo',
    send: 'Enviar mensaje', sending: 'Enviando…',
    errEmail: 'Revisa tu correo: parece que le falta algo.',
    errMissing: 'Completa tu nombre, correo y tu idea para poder responderte.',
    errWait: 'Ya recibí un mensaje tuyo hace un momento. Espera un minuto antes de enviar otro.',
    errSend: 'No se pudo enviar. Intenta de nuevo o escríbeme a devdesdeceromx@gmail.com.',
    doneH: 'Recibí tu mensaje.', doneThanks: 'Gracias, {n}. Te escribo pronto a {e}.',
  },
  footer: {
    services: 'Servicios', svc: ['Landing page', 'Sitio profesional', 'A medida'],
    work: 'Proyectos', brand: 'DevDesdeCero', links: ['Enfoque', 'Para quién', 'Proceso', 'Contacto'],
    contact: 'Contacto', remote: 'Remoto · Todo el mundo hispano',
    rights: 'Todos los derechos reservados.',
  },
};

export type Strings = typeof es;

const en: Strings = {
  meta: {
    title: 'DevDesdeCero · Web planning, design and development',
    description: 'Websites that look premium, load instantly and turn visitors into clients. Web planning, design and development in English and Spanish.',
  },
  nav: { main: 'Main', home: 'DevDesdeCero home', approach: 'Approach', work: 'Work', services: 'Services', process: 'Process', talk: "Let's talk", open: 'Open menu', close: 'Close menu', skip: 'Skip to content', lang: 'Cambiar idioma a español' },
  hero: { a: 'From', b: 'zero.', c: 'To remarkable.', sub: 'Web planning, design and development for sites that look premium, load instantly and turn visitors into clients.', cta: 'Tell me about your project', more: 'See the work', shot: 'Radio Emmanuel home page' },
  manifest: { text: 'Every website starts with a blank page. I plan the strategy, design every detail and build it to be fast, clear and yours.', accent: ['fast,', 'clear', 'yours.'] },
  details: {
    h: ['Made with an obsession', 'for detail.'],
    lede: "What you can't see matters too: speed, accessibility and search visibility from day one.",
    perf: ['Performance', 'The Google Lighthouse score I aim for on every site I deliver.', 'Score 100'],
    mobile: ['Mobile first', "Most of your clients will see you on their phone. That's where the design starts."],
    seo: ['Get found', 'Technical SEO included.', 'Your business, first on Google', 'Structure, speed and content built for search engines.'],
    edit: ["You're in control", 'Edit text and images without depending on anyone.', 'New hours'],
    honest: ['No empty promises', 'Realistic dates agreed with you, and progress you can see at every stage.'],
  },
  pide: {
    lede: 'A new way to order from local businesses in Nuevo Progreso, right from your phone. Its launch page is already signing up businesses on the waitlist.',
    live: 'Visit the live site', shot: 'PideProgreso on a phone',
    meta: [['Nuevo Progreso', 'Tamaulipas, Mexico'], ['Mobile first', 'designed for the phone'], ['Live', 'waitlist open']],
  },
  radio: {
    lede: "Live Christian radio from Edinburg, Texas, to the whole world. An always-visible player, today's schedule, song requests and an installable app, in Spanish and English.",
    meta: [['24/7', 'live stream'], ['ES · EN', 'bilingual site'], ['App', 'installable on your phone']],
  },
  giros: {
    h: ['Built around', 'your kind of business.'],
    lede: 'The same goal, more trust and more clients, with a site built around what your business offers.',
    items: [
      ['Dentists and clinics', 'Treatments, credentials, location and booking, with clear information for patients coming from abroad.'],
      ['Spas and aesthetics', 'Services with great photos, packages and booking, in a presence that conveys care.'],
      ['Beauty salons', 'Portfolio, pricing and scheduling that turn inspiration into appointments.'],
      ['Pharmacies and shops', 'Hours, location, quick contact and answers to the questions everyone asks.'],
    ],
    more: 'Different kind of business? Tell me about it',
  },
  services: {
    h: 'Which one is for you?',
    lede: 'Three packages with clear scope. We talk pricing based on what you need.',
    price: 'Priced for your project', choose: 'Choose', recommended: 'Recommended',
    plans: [
      { name: 'Essential', items: [['Landing page', 'One custom long-scroll page'], ['Agreed date', 'Based on your project'], ['WhatsApp and contact form', 'To receive leads']] },
      { name: 'Professional', items: [['4 to 6 pages', 'Home, services, about and more'], ['Reviews', 'At every stage'], ['Editable content', 'You update your site']] },
      { name: 'Custom', items: [['Store, bookings, streaming', 'Special features'], ['Staged plan', 'Based on scope'], ['Ongoing support', 'Monthly maintenance']] },
    ],
  },
  process: {
    h: ['Four steps.', 'Zero surprises.'],
    steps: [
      ['Discover', 'A call to understand your business, your clients and your goals.'],
      ['Plan', 'Sitemap, content for each page and priorities.'],
      ['Design', 'A clickable prototype for desktop and mobile, before any code.'],
      ['Launch', "Development, testing, domain and launch. I'll show you how to edit it."],
    ],
  },
  final: { h: ['Your next website', 'starts here.'], lede: 'Tell me your idea in two minutes. Our first chat is about understanding you: no pressure, no jargon.' },
  form: {
    need: 'What do you need?',
    types: [['Landing page', 'Landing page'], ['Sitio completo', 'Full website'], ['A medida', 'Store or custom'], ['Rediseño', 'Redesign'], ['No sé', 'Not sure yet']],
    name: 'Your name', email: 'Email', phone: 'Phone (optional)', business: 'Business or website (optional)', message: 'Tell me your idea',
    hp: 'Leave this field empty',
    send: 'Send message', sending: 'Sending…',
    errEmail: 'Check your email address: something seems to be missing.',
    errMissing: 'Add your name, email and idea so I can reply.',
    errWait: 'I just got a message from you. Please wait a minute before sending another.',
    errSend: "It couldn't be sent. Try again or email me at devdesdeceromx@gmail.com.",
    doneH: 'Message received.', doneThanks: "Thanks, {n}. I'll write to you soon at {e}.",
  },
  footer: {
    services: 'Services', svc: ['Landing page', 'Professional site', 'Custom'],
    work: 'Work', brand: 'DevDesdeCero', links: ['Approach', "Who it's for", 'Process', 'Contact'],
    contact: 'Contact', remote: 'Remote · Worldwide',
    rights: 'All rights reserved.',
  },
};

export const strings: Record<Lang, Strings> = { es, en };
