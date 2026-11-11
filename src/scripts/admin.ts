import type { Session } from '@supabase/supabase-js';
import { sb, body, $, esc, fmt, fdate, fday, showError, flash, tabLoaders, nav } from './core';
import './crm';

type Field = { key: string; label: string; es: string; en: string };
type Lead = {
  id: string; created_at: string; name: string; email: string | null; source: string; phone: string | null; business: string | null;
  project_type: string; message: string; lang: string; page: string | null; status: string; notes: string | null;
};
type Row = { label: string; n: number };
type Stats = {
  days: number;
  totals: { visits: number; visitors: number; prev_visits: number; prev_visitors: number; leads: number; prev_leads: number; new_leads: number };
  daily: { day: string; visits: number; leads: number }[];
  sources: Row[]; devices: Row[]; langs: Row[]; browsers: Row[]; pipeline: Record<string, number>;
};

// Etapas y orígenes del embudo (los mismos de DCX Manager).
const STATUS: Record<string, string> = { nuevo: 'Nuevo', contactado: 'Contactado', calificado: 'Calificado', cotizacion: 'Cotización', negociacion: 'Negociación', ganado: 'Ganado', perdido: 'No ganado' };
const SOURCE: Record<string, string> = { sitio: 'Página web', whatsapp: 'WhatsApp', facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', recomendacion: 'Recomendación', cliente: 'Cliente existente', directo: 'Contacto directo', otro: 'Otro' };

// Anti-clickjacking: el panel nunca se muestra dentro de un iframe de otro sitio
// (GitHub Pages no deja enviar X-Frame-Options).
if (window.top !== window.self) {
  document.body.textContent = '';
  window.top!.location.href = window.self.location.href;
  throw new Error('Panel cargado dentro de un iframe');
}

/* ---------------- Sesión ---------------- */
let recovering = false;
async function show(session: Session | null) {
  if (recovering) return;
  $('loading').hidden = true;
  if (!session) { $('login').hidden = false; $('app').hidden = true; $('l-email').focus(); return; }
  const { data: ok, error } = await sb.rpc('is_admin');
  if (error || !ok) {
    await sb.auth.signOut();
    $('login').hidden = false; $('app').hidden = true;
    loginError('Esta cuenta no tiene acceso al panel.');
    return;
  }
  $('login').hidden = true; $('app').hidden = false;
  openTab(location.hash.slice(1) || 'resumen');
}

function loginError(msg: string) { const e = $('l-err'); e.textContent = msg; e.classList.remove('info'); e.hidden = false; }

// Límite de intentos en este navegador: tras 5 fallos espera 1 min, luego 2, 4… (máx. 30).
// El límite real lo aplica Supabase Auth en el servidor (rate limits por IP).
const LOCK_KEY = 'ddc-login-lock';
type Lock = { fails: number; until: number };
function readLock(): Lock {
  try { return { fails: 0, until: 0, ...JSON.parse(localStorage.getItem(LOCK_KEY) ?? '{}') }; } catch { return { fails: 0, until: 0 }; }
}
function writeLock(l: Lock | null) {
  try { l ? localStorage.setItem(LOCK_KEY, JSON.stringify(l)) : localStorage.removeItem(LOCK_KEY); } catch {}
}

$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $<HTMLInputElement>('l-email').value.trim();
  const password = $<HTMLInputElement>('l-pass').value;
  if (!email || !password) return loginError('Escribe tu correo y contraseña.');
  const lock = readLock();
  if (lock.until > Date.now()) {
    return loginError(`Demasiados intentos. Espera ${Math.ceil((lock.until - Date.now()) / 60000)} min y vuelve a intentar.`);
  }
  const btn = $<HTMLButtonElement>('l-btn');
  btn.disabled = true; btn.textContent = 'Entrando…';
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  btn.disabled = false; btn.textContent = 'Entrar';
  if (error) {
    if (/rate|too many/i.test(error.message) || error.status === 429) return loginError('Demasiados intentos. Espera unos minutos.');
    const fails = lock.fails + 1;
    const until = fails >= 5 ? Date.now() + Math.min(2 ** (fails - 5), 30) * 60000 : 0;
    writeLock({ fails, until });
    return loginError(/invalid/i.test(error.message) ? 'Correo o contraseña incorrectos.' : 'No se pudo entrar. Intenta de nuevo.');
  }
  writeLock(null);
  $('l-err').hidden = true;
  void show(data.session);
});

// Recuperar contraseña (como en DCX Manager): Supabase manda un enlace que regresa a este panel.
$('forgot').addEventListener('click', async () => {
  const email = $<HTMLInputElement>('l-email').value.trim();
  if (!email) { loginError('Escribe tu correo y vuelve a tocar "¿Olvidaste tu contraseña?".'); $('l-email').focus(); return; }
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
  const e = $('l-err');
  e.textContent = error ? 'No se pudo enviar el correo. Intenta más tarde.' : 'Si la cuenta existe, te llegó un correo para crear una nueva contraseña.';
  e.classList.toggle('info', !error); e.hidden = false;
});
$('pw-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const a = $<HTMLInputElement>('pw-1').value, b = $<HTMLInputElement>('pw-2').value;
  const err = $('pw-err');
  if (a.length < 8) { err.textContent = 'Usa al menos 8 caracteres.'; err.hidden = false; return; }
  if (a !== b) { err.textContent = 'Las contraseñas no coinciden.'; err.hidden = false; return; }
  const { error } = await sb.auth.updateUser({ password: a });
  if (error) { err.textContent = 'No se pudo cambiar. Pide otro enlace.'; err.hidden = false; return; }
  $('pw').hidden = true;
  const { data } = await sb.auth.getSession();
  void show(data.session);
});

$('logout').addEventListener('click', async () => { await sb.auth.signOut(); location.hash = ''; void show(null); });

/* ---------------- Pestañas ---------------- */
const loaded = new Set<string>();
function openTab(name: string) {
  if (!document.querySelector(`[data-panel="${name}"]`)) name = 'resumen';
  document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  document.querySelectorAll<HTMLElement>('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== name));
  document.querySelector(`[data-tab="${name}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  history.replaceState(null, '', `#${name}`);
  showError(null);
  if (name === 'resumen') void loadStats();
  if (name === 'contactos' && !loaded.has(name)) void loadLeads();
  if (name === 'sitio' && !loaded.has(name)) { void loadTexts(); void loadSettings(); }
  tabLoaders[name]?.();
  loaded.add(name);
}
nav.open = openTab;
document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => openTab(b.dataset.tab!)));

/* ---------------- Resumen ---------------- */
let days = 30;
document.querySelectorAll<HTMLButtonElement>('[data-days]').forEach((b) => b.addEventListener('click', () => {
  days = Number(b.dataset.days);
  document.querySelectorAll('[data-days]').forEach((x) => x.classList.toggle('on', x === b));
  void loadStats();
}));

function delta(now: number, prev: number) {
  if (!prev) return now ? '<span class="d">nuevo</span>' : '<span class="d">—</span>';
  const p = Math.round(((now - prev) / prev) * 100);
  return `<span class="d ${p > 0 ? 'up' : p < 0 ? 'down' : ''}">${p > 0 ? '▲' : p < 0 ? '▼' : ''} ${Math.abs(p)}% vs. periodo anterior</span>`;
}

async function loadStats() {
  const { data, error } = await sb.rpc('admin_stats', { p_days: days });
  if (error) return showError('No se pudieron cargar las estadísticas.');
  const s = data as Stats;
  const t = s.totals;
  const conv = t.visitors ? ((t.leads / t.visitors) * 100).toFixed(1) : '0';
  $('kpis').innerHTML = [
    ['Visitas', fmt.format(t.visits), delta(t.visits, t.prev_visits)],
    ['Personas', fmt.format(t.visitors), delta(t.visitors, t.prev_visitors)],
    ['Contactos', fmt.format(t.leads), delta(t.leads, t.prev_leads)],
    ['Conversión', `${conv}%`, '<span class="d">contactos por persona</span>'],
  ].map(([k, v, d]) => `<div class="card kpi"><p class="k">${k}</p><p class="v">${v}</p>${d}</div>`).join('');
  const badge = $('badge');
  badge.textContent = String(t.new_leads); badge.hidden = !t.new_leads;
  drawChart(s.daily);
  bars('sources', s.sources);
  bars('devices', s.devices.map((r) => ({ ...r, label: ({ mobile: 'Celular', desktop: 'Computadora', tablet: 'Tableta' } as Record<string, string>)[r.label] ?? r.label })));
  bars('browsers', s.browsers);
  const pipe = Object.entries(STATUS).map(([k, label]) => ({ label, n: s.pipeline?.[k] ?? 0 }));
  const ptotal = pipe.reduce((a, r) => a + r.n, 0);
  $('pipe-total').textContent = `${ptotal} en total`;
  bars('pipeline', ptotal ? pipe : [], true);
  bars('langs', s.langs.map((r) => ({ ...r, label: ({ es: 'Español', en: 'Inglés' } as Record<string, string>)[r.label] ?? r.label })));
}

function bars(id: string, rows: Row[], keepZero = false) {
  if (!keepZero) rows = rows.filter((r) => r.n > 0);
  const max = Math.max(1, ...rows.map((r) => r.n));
  const total = rows.reduce((a, r) => a + r.n, 0) || 1;
  $(id).innerHTML = rows.length
    ? rows.map((r) => `<li><div class="bl"><span>${esc(r.label)}</span><b>${fmt.format(r.n)} <small>${Math.round((r.n / total) * 100)}%</small></b></div><div class="bt"><i style="width:${(r.n / max) * 100}%"></i></div></li>`).join('')
    : '<li class="empty">Sin datos todavía</li>';
}

function drawChart(daily: Stats['daily']) {
  const box = $('chart');
  const W = 720, H = 220, pl = 34, pr = 8, pt = 10, pb = 26;
  const max = Math.max(4, ...daily.map((d) => d.visits));
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / step) * step;
  const n = daily.length;
  const bw = (W - pl - pr) / n;
  const y = (v: number) => pt + (H - pt - pb) * (1 - v / top);
  const ticks = [0, top / 2, top];
  const every = Math.ceil(n / 6);
  let svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">`;
  ticks.forEach((v) => { svg += `<line class="grid" x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${pl - 6}" y="${y(v) + 4}" text-anchor="end">${fmt.format(v)}</text>`; });
  daily.forEach((d, i) => {
    const x = pl + i * bw;
    const h = H - pb - y(d.visits);
    const w = Math.max(1, bw - 2);
    if (d.visits) {
      const r = Math.min(4, w / 2, h);
      const bx = x + 1, by = y(d.visits), base = H - pb;
      svg += `<path class="bar" d="M${bx},${base}V${by + r}Q${bx},${by} ${bx + r},${by}H${bx + w - r}Q${bx + w},${by} ${bx + w},${by + r}V${base}Z"/>`;
    }
    if (d.leads) svg += `<circle class="lead" cx="${x + bw / 2}" cy="${y(d.visits) - 7}" r="3.5"/>`;
    svg += `<rect class="hit" data-i="${i}" x="${x}" y="${pt}" width="${bw}" height="${H - pt - pb}"/>`;
    if (i % every === 0) svg += `<text class="ax" x="${x + bw / 2}" y="${H - 8}" text-anchor="middle">${fday.format(new Date(d.day))}</text>`;
  });
  svg += `<line class="base" x1="${pl}" x2="${W - pr}" y1="${H - pb}" y2="${H - pb}"/></svg>`;
  box.innerHTML = svg;
  const total = daily.reduce((a, d) => a + d.visits, 0);
  box.setAttribute('aria-label', `Visitas por día: ${total} en ${n} días.`);

  const tip = $('chart-tip');
  box.querySelectorAll<SVGRectElement>('.hit').forEach((r) => {
    const on = () => {
      const d = daily[Number(r.dataset.i)];
      box.querySelectorAll('.hit').forEach((x) => x.classList.toggle('on', x === r));
      tip.innerHTML = `<b>${fday.format(new Date(d.day))}</b><span>${fmt.format(d.visits)} visitas</span>${d.leads ? `<span>${d.leads} contacto${d.leads > 1 ? 's' : ''}</span>` : ''}`;
      tip.hidden = false;
      const br = box.getBoundingClientRect(), rr = r.getBoundingClientRect();
      const left = Math.min(br.width - tip.offsetWidth, Math.max(0, rr.left - br.left + rr.width / 2 - tip.offsetWidth / 2));
      tip.style.left = `${left}px`;
    };
    r.addEventListener('mouseenter', on);
    r.addEventListener('click', on);
  });
  box.onmouseleave = () => { tip.hidden = true; box.querySelectorAll('.hit').forEach((x) => x.classList.remove('on')); };

  $('chart-table').innerHTML = `<table class="tbl"><thead><tr><th>Día</th><th>Visitas</th><th>Contactos</th></tr></thead><tbody>${
    [...daily].reverse().map((d) => `<tr><td>${fday.format(new Date(d.day))}</td><td>${d.visits}</td><td>${d.leads}</td></tr>`).join('')}</tbody></table>`;
}
$('tbl-toggle').addEventListener('click', () => {
  const t = $('chart-table'); t.hidden = !t.hidden;
  $('tbl-toggle').textContent = t.hidden ? 'Ver tabla' : 'Ocultar tabla';
});

/* ---------------- Contactos ---------------- */
let leads: Lead[] = [];
async function loadLeads() {
  const { data, error } = await sb.from('leads').select('id,created_at,name,email,source,phone,business,project_type,message,lang,page,status,notes').order('created_at', { ascending: false }).limit(500);
  if (error) return showError('No se pudieron cargar los contactos.');
  leads = data as Lead[];
  renderLeads();
}

function filtered() {
  const q = $<HTMLInputElement>('q').value.trim().toLowerCase();
  const st = $<HTMLSelectElement>('f-status').value;
  return leads.filter((l) => (!st || l.status === st) && (!q || [l.name, l.email, l.business, l.message].some((v) => v?.toLowerCase().includes(q))));
}

function renderLeads() {
  const list = filtered();
  const box = $('leads');
  if (!list.length) { box.innerHTML = `<div class="card empty">${leads.length ? 'Nada coincide con el filtro.' : 'Aún no llegan contactos. Aquí aparecerán los mensajes del formulario.'}</div>`; return; }
  box.innerHTML = list.map((l) => `
    <article class="card lead" data-id="${l.id}">
      <header>
        <div><h3>${esc(l.name)}</h3><p class="muted">${esc(l.business ?? '')}${l.business ? ' · ' : ''}${esc(l.project_type)} · ${esc(SOURCE[l.source] ?? l.source)}</p></div>
        <select class="st st-${l.status}" aria-label="Estado de ${esc(l.name)}">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}"${k === l.status ? ' selected' : ''}>${v}</option>`).join('')}</select>
      </header>
      <p class="msg">${esc(l.message)}</p>
      <p class="meta">${l.email ? `<a href="mailto:${esc(l.email)}?subject=${encodeURIComponent('Tu proyecto con DevDesdeCero')}">${esc(l.email)}</a>` : ''}${l.phone ? `${l.email ? ' · ' : ''}<a href="tel:${esc(l.phone.replace(/[^0-9+]/g, ''))}">${esc(l.phone)}</a>` : ''}<span>${fdate.format(new Date(l.created_at))}</span></p>
      <details><summary>Notas${l.notes ? ' ·' : ''}</summary>
        <textarea rows="3" placeholder="Notas privadas sobre este contacto">${esc(l.notes ?? '')}</textarea>
        <div class="actions"><button class="link danger" data-del type="button">Borrar contacto</button><button class="btn sm" data-client type="button">Convertir en cliente</button><span class="saved" hidden>Guardado</span><button class="btn sm" data-save type="button">Guardar nota</button></div>
      </details>
    </article>`).join('');
}
$('q').addEventListener('input', renderLeads);
$('f-status').addEventListener('change', renderLeads);

$('leads').addEventListener('change', async (e) => {
  const sel = e.target as HTMLSelectElement;
  if (!sel.classList.contains('st')) return;
  const id = sel.closest<HTMLElement>('[data-id]')!.dataset.id!;
  const { error } = await sb.from('leads').update({ status: sel.value, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return showError('No se pudo cambiar el estado.');
  const l = leads.find((x) => x.id === id)!; l.status = sel.value;
  sel.className = `st st-${sel.value}`;
  void loadStatsBadge();
});
$('leads').addEventListener('click', async (e) => {
  const btn = (e.target as HTMLElement).closest('button');
  if (!btn) return;
  const card = btn.closest<HTMLElement>('[data-id]')!;
  const id = card.dataset.id!;
  if (btn.hasAttribute('data-save')) {
    const notes = card.querySelector('textarea')!.value.trim() || null;
    const { error } = await sb.from('leads').update({ notes, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) return showError('No se pudo guardar la nota.');
    leads.find((x) => x.id === id)!.notes = notes;
    flash(card.querySelector('.saved') as HTMLElement);
  }
  if (btn.hasAttribute('data-client')) {
    const { error } = await sb.rpc('convert_lead_to_client', { p_lead: id });
    if (error) return showError('No se pudo convertir en cliente.');
    const l = leads.find((x) => x.id === id); if (l) l.status = 'ganado';
    nav.open('clientes');
  }
  if (btn.hasAttribute('data-del')) {
    if (!confirm('¿Borrar este contacto? No se puede deshacer.')) return;
    const { error } = await sb.from('leads').delete().eq('id', id);
    if (error) return showError('No se pudo borrar.');
    leads = leads.filter((x) => x.id !== id);
    renderLeads();
  }
});

async function loadStatsBadge() {
  const { count } = await sb.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'nuevo');
  const badge = $('badge'); badge.textContent = String(count ?? 0); badge.hidden = !count;
}

$('csv').addEventListener('click', () => {
  const cols: (keyof Lead)[] = ['created_at', 'name', 'email', 'phone', 'business', 'project_type', 'source', 'status', 'lang', 'message', 'notes'];
  const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [cols.join(','), ...filtered().map((l) => cols.map((c) => cell(l[c])).join(','))].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `contactos-devdesdecero-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
});

/* Agregar prospecto a mano (llegó por WhatsApp, recomendación, etc.) */
const dlg = $<HTMLDialogElement>('new-lead');
$('add-lead').addEventListener('click', () => { ($('nl-form') as HTMLFormElement).reset(); $('nl-err').hidden = true; dlg.showModal(); });
$('nl-cancel').addEventListener('click', () => dlg.close());
$('nl-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target as HTMLFormElement);
  const v = (k: string) => String(fd.get(k) ?? '').trim() || null;
  const err = $('nl-err');
  if (!v('name') || !v('message')) { err.textContent = 'Escribe el nombre y qué necesita.'; err.hidden = false; return; }
  if (!v('email') && !v('phone')) { err.textContent = 'Agrega al menos un correo o teléfono.'; err.hidden = false; return; }
  const { error } = await sb.from('leads').insert({
    name: v('name'), email: v('email')?.toLowerCase() ?? null, phone: v('phone'), business: v('business'),
    project_type: v('project_type') ?? 'No sé', message: v('message'), source: v('source') ?? 'otro', lang: 'es', status: 'nuevo',
  });
  if (error) { err.textContent = 'No se pudo guardar. Revisa los datos.'; err.hidden = false; return; }
  dlg.close();
  await loadLeads();
  void loadStatsBadge();
});

/* ---------------- Textos ---------------- */
const fields: Field[] = JSON.parse(body.fields ?? '[]');
let tlang: 'es' | 'en' = 'es';
let texts: { key: string; lang: string; value: string }[] = [];

async function loadTexts() {
  const { data, error } = await sb.from('site_texts').select('key,lang,value');
  if (error) return showError('No se pudieron cargar los textos.');
  texts = data ?? [];
  renderTexts();
}
function renderTexts() {
  $('texts').innerHTML = fields.map((f) => {
    const cur = texts.find((t) => t.key === f.key && t.lang === tlang)?.value ?? '';
    return `<label>${esc(f.label)}<textarea name="${f.key}" rows="3" maxlength="1000" placeholder="${esc(f[tlang])}">${esc(cur)}</textarea></label>`;
  }).join('') + '<div class="actions"><span class="saved" id="t-ok" hidden>Guardado</span><button class="btn primary" type="submit">Guardar textos</button></div>';
}
document.querySelectorAll<HTMLButtonElement>('[data-tlang]').forEach((b) => b.addEventListener('click', () => {
  tlang = b.dataset.tlang as 'es' | 'en';
  document.querySelectorAll('[data-tlang]').forEach((x) => x.classList.toggle('on', x === b));
  renderTexts();
}));
$('texts').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target as HTMLFormElement);
  const upsert: { key: string; lang: string; value: string; updated_at: string }[] = [];
  const remove: string[] = [];
  fields.forEach((f) => {
    const v = String(fd.get(f.key) ?? '').trim();
    if (v) upsert.push({ key: f.key, lang: tlang, value: v, updated_at: new Date().toISOString() });
    else remove.push(f.key);
  });
  const r1 = upsert.length ? await sb.from('site_texts').upsert(upsert) : { error: null };
  const r2 = remove.length ? await sb.from('site_texts').delete().eq('lang', tlang).in('key', remove) : { error: null };
  if (r1.error || r2.error) return showError('No se pudieron guardar los textos.');
  await loadTexts();
  flash($('t-ok'));
});

/* ---------------- Correo y redes ---------------- */
const SKEYS = ['contact_email', 'facebook_url', 'instagram_url', 'tiktok_url', 'youtube_url', 'linkedin_url'] as const;
async function loadSettings() {
  const { data, error } = await sb.from('site_settings').select(SKEYS.join(',')).eq('id', true).single();
  if (error) return showError('No se pudieron cargar los ajustes.');
  const form = $<HTMLFormElement>('settings');
  SKEYS.forEach((k) => { (form.elements.namedItem(k) as HTMLInputElement).value = (data as unknown as Record<string, string | null>)[k] ?? ''; });
}
$('settings').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target as HTMLFormElement;
  const patch: Record<string, string | null> = { updated_at: new Date().toISOString() };
  for (const k of SKEYS) {
    const input = form.elements.namedItem(k) as HTMLInputElement;
    const v = input.value.trim();
    if (k !== 'contact_email' && v && !/^https:\/\//.test(v)) { showError('Los enlaces de redes deben empezar con https://'); input.focus(); return; }
    patch[k] = v || null;
  }
  if (!patch.contact_email) { showError('El correo de contacto es obligatorio.'); return; }
  const { error } = await sb.from('site_settings').update(patch).eq('id', true);
  if (error) return showError('No se pudieron guardar los ajustes.');
  showError(null);
  flash($('s-ok'));
});


/* ---------------- Arranque ---------------- */
sb.auth.getSession().then(({ data }) => show(data.session));
sb.auth.onAuthStateChange((ev) => {
  if (ev === 'SIGNED_OUT') { $('app').hidden = true; $('login').hidden = false; }
  if (ev === 'PASSWORD_RECOVERY') { recovering = true; $('loading').hidden = true; $('login').hidden = true; $('app').hidden = true; $('pw').hidden = false; $('pw-1').focus(); }
});
document.querySelectorAll<HTMLButtonElement>('[data-goto]').forEach((b) => b.addEventListener('click', () => openTab(b.dataset.goto!)));
