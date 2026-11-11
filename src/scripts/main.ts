import { rpc, supabaseReady } from './supabase';

const lang = (document.body.dataset.lang === 'en' ? 'en' : 'es') as 'es' | 'en';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Efectos de scroll ---------- */
const lap = document.getElementById('laptop');
const man = document.getElementById('manifiesto');
const words = [...document.querySelectorAll<HTMLElement>('#mtext .w')];

function onScroll() {
  const vh = innerHeight;
  if (!reduce && lap) {
    const r = lap.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, 1 - (r.top - vh * 0.25) / (vh * 0.75)));
    lap.style.transform = `rotateX(${(22 * (1 - p)).toFixed(2)}deg) scale(${(0.86 + 0.14 * p).toFixed(3)})`;
  }
  if (man) {
    const m = man.getBoundingClientRect();
    const prog = reduce ? 1 : Math.min(1, Math.max(0, (-m.top + vh * 0.15) / (m.height - vh * 1.1)));
    const n = Math.round(prog * words.length);
    words.forEach((w, i) => w.classList.toggle('on', i < n));
  }
}
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', onScroll);
onScroll();

/* ---------- Menú móvil ---------- */
const burger = document.getElementById('burger') as HTMLButtonElement | null;
const mnav = document.getElementById('mnav');
function menu(open: boolean) {
  if (!burger || !mnav) return;
  mnav.hidden = !open;
  burger.setAttribute('aria-expanded', String(open));
  burger.setAttribute('aria-label', (open ? burger.dataset.close : burger.dataset.open) ?? '');
}
burger?.addEventListener('click', () => menu(!!mnav?.hidden));
mnav?.addEventListener('click', (e) => { if ((e.target as Element).closest('a')) menu(false); });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && mnav && !mnav.hidden) { menu(false); burger?.focus(); } });

/* ---------- Revelado al hacer scroll ---------- */
const ring = document.getElementById('ring');
if (!reduce && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.remove('pre');
    if (ring && e.target.contains(ring)) ring.classList.add('go');
    io.unobserve(e.target);
  }), { threshold: 0.15 });
  document.querySelectorAll('.rv').forEach((el) => {
    if (el.getBoundingClientRect().top > innerHeight) { el.classList.add('pre'); io.observe(el); }
    else if (ring && el.contains(ring)) ring.classList.add('go');
  });
} else ring?.classList.add('go');

/* ---------- "Elegir" en paquetes preselecciona el tipo ---------- */
document.querySelectorAll<HTMLElement>('[data-pick]').forEach((a) => a.addEventListener('click', () => {
  const r = document.querySelector<HTMLInputElement>(`input[name="tipo"][value="${a.dataset.pick}"]`);
  if (r) r.checked = true;
}));

/* ---------- Analítica propia (sin cookies ni identificadores guardados en el navegador) ----------
   El servidor agrupa las visitas con un hash diario que no se puede revertir. */
function clientInfo() {
  const ua = navigator.userAgent;
  const device = /iPad|Tablet/i.test(ua) ? 'tablet' : /Mobi|Android/i.test(ua) ? 'mobile' : 'desktop';
  const browser = /Edg/i.test(ua) ? 'Edge' : /Chrome/i.test(ua) ? 'Chrome' : /Safari/i.test(ua) ? 'Safari' : /Firefox/i.test(ua) ? 'Firefox' : 'Otro';
  const os = /Windows/i.test(ua) ? 'Windows' : /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iOS' : /Mac/i.test(ua) ? 'macOS' : /Linux/i.test(ua) ? 'Linux' : 'Otro';
  return { device, browser, os };
}
function track(event: 'page_view' | 'lead') {
  if (!supabaseReady) return;
  const q = new URLSearchParams(location.search);
  const info = clientInfo();
  let referrer = '';
  try { referrer = document.referrer ? new URL(document.referrer).hostname : ''; } catch { /* sin referrer */ }
  if (referrer === location.hostname) referrer = '';
  void rpc('track_event', {
    p_event: event,
    // ID desechable por carga de página (no se guarda); el servidor lo reemplaza por su hash diario.
    p_visitor_id: crypto.randomUUID(),
    p_session_id: crypto.randomUUID(),
    p_path: location.pathname,
    p_lang: lang,
    p_referrer: referrer || null,
    p_utm_source: q.get('utm_source'),
    p_utm_medium: q.get('utm_medium'),
    p_utm_campaign: q.get('utm_campaign'),
    p_device: info.device,
    p_browser: info.browser,
    p_os: info.os,
    p_screen_width: screen.width,
  }).catch(() => {});
}
track('page_view');

/* ---------- Textos y redes editables desde Supabase ---------- */
type SiteContent = { texts?: Record<string, string>; email?: string | null; socials?: Record<string, string> };
if (supabaseReady) {
  rpc<SiteContent>('get_site_content', { p_lang: lang }).then((c) => {
    if (!c) return;
    Object.entries(c.texts ?? {}).forEach(([key, value]) => {
      document.querySelectorAll<HTMLElement>(`[data-edit="${key}"]`).forEach((el) => { if (value) el.textContent = value; });
    });
    if (c.email) document.querySelectorAll<HTMLAnchorElement>('[data-edit-email]').forEach((a) => { a.href = `mailto:${c.email}`; a.textContent = c.email!; });
    const box = document.getElementById('socials');
    if (box && c.socials) {
      Object.entries(c.socials).forEach(([name, url]) => {
        if (!/^https:\/\//.test(url)) return;
        const a = document.createElement('a');
        a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = name;
        box.appendChild(a);
      });
    }
  }).catch(() => {});
}

/* ---------- Formulario de contacto ---------- */
const form = document.getElementById('contacto') as HTMLFormElement | null;
const loadedAt = Date.now();
if (form) {
  const d = form.dataset;
  const err = document.getElementById('ferr') as HTMLElement;
  const btn = document.getElementById('fbtn') as HTMLButtonElement;
  const val = (id: string) => (document.getElementById(id) as HTMLInputElement).value.trim();
  const emailOk = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
  const showErr = (msg: string) => { err.textContent = msg; err.hidden = false; };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const bad: string[] = [];
    ['nombre', 'correo', 'mensaje'].forEach((id) => {
      const el = document.getElementById(id) as HTMLInputElement;
      const ok = !!el.value.trim() && (id !== 'correo' || emailOk(el.value.trim()));
      el.parentElement!.classList.toggle('bad', !ok);
      el.setAttribute('aria-invalid', ok ? 'false' : 'true');
      if (!ok) bad.push(id);
    });
    if (bad.length) {
      showErr(bad.includes('correo') && val('correo') ? d.errEmail! : d.errMissing!);
      document.getElementById(bad[0])!.focus();
      return;
    }
    let last = 0;
    try { last = Number(localStorage.getItem('ddc-last-lead') ?? 0); } catch { /* sin storage */ }
    if (Date.now() - last < 60_000) { showErr(d.errWait!); return; }

    err.hidden = true;
    btn.disabled = true; btn.textContent = d.sending!;
    const tipo = (form.querySelector('input[name="tipo"]:checked') as HTMLInputElement | null)?.value ?? 'No sé';
    try {
      if (!supabaseReady) throw new Error('Supabase no configurado');
      await rpc('submit_lead', {
        p_name: val('nombre'),
        p_email: val('correo'),
        p_phone: val('telefono') || null,
        p_business: val('negocio') || null,
        p_project_type: tipo,
        p_message: val('mensaje'),
        p_lang: lang,
        p_page: location.pathname,
        p_hp: val('sitio_web') || null,
        p_elapsed_ms: Date.now() - loadedAt,
      });
      try { localStorage.setItem('ddc-last-lead', String(Date.now())); } catch { /* sin storage */ }
      track('lead');
      const name = val('nombre').split(' ')[0];
      (document.getElementById('done-txt') as HTMLElement).textContent = d.thanks!.replace('{n}', name).replace('{e}', val('correo'));
      (document.getElementById('fields') as HTMLElement).hidden = true;
      (document.getElementById('done') as HTMLElement).hidden = false;
      (document.getElementById('done-h') as HTMLElement).focus({ preventScroll: true });
      form.reset();
    } catch (ex) {
      const msg = ex instanceof Error && /espera|wait/i.test(ex.message) ? d.errWait! : d.errSend!;
      showErr(msg);
    } finally {
      btn.disabled = false; btn.textContent = d.send!;
    }
  });
}
