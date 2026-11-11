// CRM DevDesdeCero: clientes, cotizaciones, proyectos y finanzas.
import { sb, $, esc, money, flong, today, showError, flash, tabLoaders, nav, formValues, num } from './core';

type Client = { id: string; folio: string; lead_id: string | null; name: string; business: string | null; email: string | null; phone: string | null; address: string | null; notes: string | null; status: string; created_at: string };
type Item = { id?: string; description: string; quantity: number; unit_price: number; sort_order: number };
type Quote = { id: string; folio: string; client_id: string; title: string; description: string | null; status: string; subtotal: number; discount: number; tax_rate: number; total: number; valid_until: string | null; notes: string | null; created_at: string; clients?: { name: string; business: string | null; email: string | null; phone: string | null } | null; quote_items?: Item[]; projects?: { id: string }[] };
type Task = { id: string; title: string; done: boolean; due_date: string | null; sort_order: number };
type Payment = { id: string; kind: string; amount: number; method: string; paid_at: string; reference: string | null };
type Expense = { id: string; project_id: string | null; category: string; description: string; amount: number; spent_at: string; projects?: { folio: string; name: string } | null };
type Project = { id: string; folio: string; client_id: string; quote_id: string | null; name: string; description: string | null; url: string | null; start_date: string | null; due_date: string | null; price: number; status: string; created_at: string; clients?: { name: string; business: string | null } | null; project_tasks?: Task[]; project_payments?: Payment[]; project_expenses?: Expense[] };

const QSTATUS: Record<string, string> = { borrador: 'Borrador', enviada: 'Enviada', negociacion: 'Negociación', aceptada: 'Aceptada', rechazada: 'Rechazada', vencida: 'Vencida' };
const PSTATUS: Record<string, string> = { preparacion: 'Preparación', espera_anticipo: 'Esperando anticipo', desarrollo: 'En desarrollo', revision: 'En revisión', entregado: 'Entregado', garantia: 'Garantía', cerrado: 'Cerrado', pausado: 'Pausado', cancelado: 'Cancelado' };
const PAYKIND: Record<string, string> = { anticipo: 'Anticipo', parcial: 'Parcial', final: 'Liquidación' };
const PAYMETHOD: Record<string, string> = { transferencia: 'Transferencia', efectivo: 'Efectivo', tarjeta: 'Tarjeta', otro: 'Otro' };
const ECAT: Record<string, string> = { herramientas: 'Herramientas', hosting: 'Hosting', dominio: 'Dominio', licencias: 'Licencias', colaboradores: 'Colaboradores', publicidad: 'Publicidad', impuestos: 'Impuestos', otro: 'Otro' };

const opts = (map: Record<string, string>, sel?: string) => Object.entries(map).map(([k, v]) => `<option value="${k}"${k === sel ? ' selected' : ''}>${esc(v)}</option>`).join('');
const dayLabel = (d: string | null) => (d ? flong.format(new Date(d)) : '—');
const err = (msg: string, e?: { message?: string } | null) => showError(e?.message && /supera|no válid|Cotización|Contacto/.test(e.message) ? e.message : msg);

let clients: Client[] = [];
async function fetchClients() {
  const { data, error } = await sb.from('clients').select('*').order('created_at', { ascending: false });
  if (error) { err('No se pudieron cargar los clientes.'); return; }
  clients = data as Client[];
}
const clientOptions = (sel?: string) => clients.filter((c) => c.status === 'activo' || c.id === sel)
  .map((c) => `<option value="${c.id}"${c.id === sel ? ' selected' : ''}>${esc(c.name)}${c.business ? ` · ${esc(c.business)}` : ''}</option>`).join('');

function dialog(id: string) { return $<HTMLDialogElement>(id); }
document.querySelectorAll<HTMLButtonElement>('[data-close]').forEach((b) => b.addEventListener('click', () => (b.closest('dialog') as HTMLDialogElement).close()));

/* =============================== Clientes =============================== */
async function loadClients() {
  await fetchClients();
  const { data: proj } = await sb.from('projects').select('client_id,status');
  const active = new Map<string, number>();
  (proj ?? []).forEach((p) => { if (!['cerrado', 'cancelado'].includes(p.status)) active.set(p.client_id, (active.get(p.client_id) ?? 0) + 1); });
  renderClients(active);
}
function renderClients(active = new Map<string, number>()) {
  const q = $<HTMLInputElement>('c-q').value.trim().toLowerCase();
  const list = clients.filter((c) => !q || [c.name, c.business, c.email, c.folio].some((v) => v?.toLowerCase().includes(q)));
  $('clients').innerHTML = list.length ? `<div class="card table-card"><table class="tbl rows"><thead><tr><th>Cliente</th><th>Contacto</th><th>Proyectos activos</th><th>Estado</th></tr></thead><tbody>${
    list.map((c) => `<tr data-id="${c.id}" tabindex="0"><td><b>${esc(c.name)}</b><small>${esc(c.folio)}${c.business ? ' · ' + esc(c.business) : ''}</small></td><td>${esc(c.email ?? '')}<small>${esc(c.phone ?? '')}</small></td><td>${active.get(c.id) ?? 0}</td><td><span class="chip ${c.status === 'activo' ? 'ok' : ''}">${c.status === 'activo' ? 'Activo' : 'Inactivo'}</span></td></tr>`).join('')
  }</tbody></table></div>` : `<div class="card empty">${clients.length ? 'Nada coincide con la búsqueda.' : 'Aún no hay clientes. Conviértelos desde Contactos o agrégalos aquí.'}</div>`;
}
$('c-q').addEventListener('input', () => renderClients());
function openClient(c?: Client) {
  const f = $<HTMLFormElement>('client-form');
  f.reset();
  $('client-h').textContent = c ? `${c.name} · ${c.folio}` : 'Nuevo cliente';
  (f.elements.namedItem('id') as HTMLInputElement).value = c?.id ?? '';
  (['name', 'business', 'email', 'phone', 'address', 'notes', 'status'] as const).forEach((k) => { if (c) (f.elements.namedItem(k) as HTMLInputElement).value = (c[k] as string) ?? ''; });
  $('client-actions').hidden = !c;
  dialog('client-dlg').showModal();
}
$('add-client').addEventListener('click', () => openClient());
$('clients').addEventListener('click', (e) => { const tr = (e.target as HTMLElement).closest<HTMLElement>('tr[data-id]'); if (tr) openClient(clients.find((c) => c.id === tr.dataset.id)); });
$('clients').addEventListener('keydown', (e) => { if (e.key === 'Enter') (e.target as HTMLElement).click(); });
$('client-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const v = formValues(e.target as HTMLFormElement);
  if (!v('name')) return;
  const row = { name: v('name'), business: v('business'), email: v('email')?.toLowerCase() ?? null, phone: v('phone'), address: v('address'), notes: v('notes'), status: v('status') ?? 'activo' };
  const id = v('id');
  const { error } = id ? await sb.from('clients').update(row).eq('id', id) : await sb.from('clients').insert(row);
  if (error) return err('No se pudo guardar el cliente.', error);
  dialog('client-dlg').close();
  void loadClients();
});
$('client-quote').addEventListener('click', () => { const id = ($<HTMLFormElement>('client-form').elements.namedItem('id') as HTMLInputElement).value; dialog('client-dlg').close(); nav.open('cotizaciones'); void openQuote(undefined, id); });

/* ============================= Cotizaciones ============================= */
let quotes: Quote[] = [];
async function loadQuotes() {
  const [{ data, error }] = await Promise.all([
    sb.from('quotes').select('*, clients(name,business,email,phone), projects(id)').order('created_at', { ascending: false }),
    fetchClients(),
  ]);
  if (error) return err('No se pudieron cargar las cotizaciones.');
  quotes = data as Quote[];
  renderQuotes();
}
function renderQuotes() {
  const st = $<HTMLSelectElement>('q-status').value;
  const list = quotes.filter((q) => !st || q.status === st);
  $('quotes').innerHTML = list.length ? `<div class="card table-card"><table class="tbl rows"><thead><tr><th>Cotización</th><th>Cliente</th><th class="r">Total</th><th>Estado</th></tr></thead><tbody>${
    list.map((q) => `<tr data-id="${q.id}" tabindex="0"><td><b>${esc(q.title)}</b><small>${esc(q.folio)} · ${dayLabel(q.created_at.slice(0, 10))}</small></td><td>${esc(q.clients?.name ?? '')}<small>${esc(q.clients?.business ?? '')}</small></td><td class="r num">${money.format(q.total)}</td><td><span class="chip q-${q.status}">${QSTATUS[q.status]}</span></td></tr>`).join('')
  }</tbody></table></div>` : `<div class="card empty">${quotes.length ? 'Nada con ese estado.' : 'Aún no hay cotizaciones.'}</div>`;
}
$('q-status').addEventListener('change', renderQuotes);
$('quotes').addEventListener('click', (e) => { const tr = (e.target as HTMLElement).closest<HTMLElement>('tr[data-id]'); if (tr) void openQuote(tr.dataset.id); });
$('quotes').addEventListener('keydown', (e) => { if (e.key === 'Enter') (e.target as HTMLElement).click(); });
$('add-quote').addEventListener('click', () => void openQuote());

function itemRow(it?: Partial<Item>) {
  return `<div class="item"><input name="i_desc" placeholder="Concepto (ej. Diseño de 5 páginas)" maxlength="500" value="${esc(it?.description ?? '')}" aria-label="Concepto"/><input name="i_qty" type="number" min="0.01" step="0.01" value="${it?.quantity ?? 1}" aria-label="Cantidad"/><input name="i_price" type="number" min="0" step="0.01" value="${it?.unit_price ?? ''}" placeholder="Precio" aria-label="Precio unitario"/><b class="num i-total"></b><button type="button" class="x" data-rm aria-label="Quitar concepto">×</button></div>`;
}
function quoteTotals() {
  const f = $<HTMLFormElement>('quote-form');
  let sub = 0;
  f.querySelectorAll('#q-items .item').forEach((r) => {
    const q = num((r.querySelector('[name=i_qty]') as HTMLInputElement).value), p = num((r.querySelector('[name=i_price]') as HTMLInputElement).value);
    (r.querySelector('.i-total') as HTMLElement).textContent = money.format(q * p);
    sub += q * p;
  });
  const disc = num((f.elements.namedItem('discount') as HTMLInputElement).value), tax = num((f.elements.namedItem('tax_rate') as HTMLInputElement).value);
  const total = Math.max(sub - disc, 0) * (1 + tax / 100);
  $('q-sub').textContent = money.format(sub); $('q-total').textContent = money.format(total);
}
async function openQuote(id?: string, clientId?: string) {
  if (!clients.length) await fetchClients();
  if (!clients.length) { showError('Primero agrega un cliente.'); nav.open('clientes'); return; }
  let q: Quote | undefined;
  if (id) {
    const { data, error } = await sb.from('quotes').select('*, clients(name,business,email,phone), quote_items(*), projects(id)').eq('id', id).single();
    if (error) return err('No se pudo abrir la cotización.');
    q = data as Quote;
  }
  const f = $<HTMLFormElement>('quote-form');
  f.reset();
  $('quote-h').textContent = q ? `${q.folio} · ${q.title}` : 'Nueva cotización';
  (f.elements.namedItem('id') as HTMLInputElement).value = q?.id ?? '';
  (f.elements.namedItem('client_id') as HTMLSelectElement).innerHTML = clientOptions(q?.client_id ?? clientId);
  (f.elements.namedItem('status') as HTMLSelectElement).innerHTML = opts(QSTATUS, q?.status ?? 'borrador');
  (['title', 'description', 'notes', 'valid_until'] as const).forEach((k) => ((f.elements.namedItem(k) as HTMLInputElement).value = (q?.[k] as string) ?? ''));
  if (!q) (f.elements.namedItem('valid_until') as HTMLInputElement).value = new Date(Date.now() + 15 * 864e5).toISOString().slice(0, 10);
  (f.elements.namedItem('discount') as HTMLInputElement).value = String(q?.discount ?? 0);
  (f.elements.namedItem('tax_rate') as HTMLInputElement).value = String(q?.tax_rate ?? 0);
  const items = (q?.quote_items ?? []).sort((a, b) => a.sort_order - b.sort_order);
  $('q-items').innerHTML = (items.length ? items : [{}]).map(itemRow).join('');
  quoteTotals();
  const hasProject = !!q?.projects?.length;
  $('q-pdf').hidden = !q; $('q-accept').hidden = !q || hasProject;
  $('q-accept').textContent = 'Aceptar y crear proyecto';
  $('q-project').hidden = !hasProject;
  dialog('quote-dlg').showModal();
}
$('q-items').addEventListener('input', quoteTotals);
$('quote-form').addEventListener('input', (e) => { if ((e.target as HTMLInputElement).name === 'discount' || (e.target as HTMLInputElement).name === 'tax_rate') quoteTotals(); });
$('q-items').addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest('[data-rm]'); if (b && $('q-items').children.length > 1) { b.parentElement!.remove(); quoteTotals(); } });
$('q-add-item').addEventListener('click', () => { $('q-items').insertAdjacentHTML('beforeend', itemRow()); ($('q-items').lastElementChild!.querySelector('input') as HTMLInputElement).focus(); });

async function saveQuote(): Promise<string | null> {
  const f = $<HTMLFormElement>('quote-form');
  const v = formValues(f);
  const items: Item[] = [...f.querySelectorAll('#q-items .item')].map((r, i) => ({
    description: (r.querySelector('[name=i_desc]') as HTMLInputElement).value.trim(),
    quantity: num((r.querySelector('[name=i_qty]') as HTMLInputElement).value) || 1,
    unit_price: num((r.querySelector('[name=i_price]') as HTMLInputElement).value),
    sort_order: i,
  })).filter((it) => it.description);
  if (!v('title') || !v('client_id')) { showError('La cotización necesita cliente y título.'); return null; }
  const row = { client_id: v('client_id'), title: v('title'), description: v('description'), status: v('status') ?? 'borrador', discount: num(v('discount')), tax_rate: num(v('tax_rate')), valid_until: v('valid_until'), notes: v('notes') };
  let id = v('id');
  if (id) {
    const { error } = await sb.from('quotes').update(row).eq('id', id);
    if (error) { err('No se pudo guardar la cotización.', error); return null; }
    const { error: e2 } = await sb.from('quote_items').delete().eq('quote_id', id);
    if (e2) { err('No se pudieron guardar los conceptos.'); return null; }
  } else {
    const { data, error } = await sb.from('quotes').insert(row).select('id').single();
    if (error) { err('No se pudo crear la cotización.', error); return null; }
    id = data.id as string;
    (f.elements.namedItem('id') as HTMLInputElement).value = id;
  }
  if (items.length) {
    const { error } = await sb.from('quote_items').insert(items.map((it) => ({ ...it, quote_id: id })));
    if (error) { err('No se pudieron guardar los conceptos.'); return null; }
  }
  showError(null);
  return id;
}
$('quote-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (await saveQuote()) { dialog('quote-dlg').close(); void loadQuotes(); }
});
$('q-pdf').addEventListener('click', async () => {
  const id = await saveQuote(); if (!id) return;
  const { data } = await sb.from('quotes').select('*, clients(name,business,email,phone), quote_items(*)').eq('id', id).single();
  if (data) printQuote(data as Quote);
  void loadQuotes();
});
$('q-accept').addEventListener('click', async () => {
  const id = await saveQuote(); if (!id) return;
  if (!confirm('¿Marcar como aceptada y crear el proyecto?')) return;
  const { data, error } = await sb.rpc('accept_quote', { p_quote: id });
  if (error) return err('No se pudo crear el proyecto.', error);
  dialog('quote-dlg').close();
  nav.open('proyectos');
  void openProject(data as string);
});
$('q-project').addEventListener('click', async () => {
  const id = ($<HTMLFormElement>('quote-form').elements.namedItem('id') as HTMLInputElement).value;
  const { data } = await sb.from('projects').select('id').eq('quote_id', id).single();
  dialog('quote-dlg').close(); nav.open('proyectos'); if (data) void openProject(data.id);
});

// PDF: abre una hoja lista para imprimir o "Guardar como PDF".
function printQuote(q: Quote) {
  const items = (q.quote_items ?? []).sort((a, b) => a.sort_order - b.sort_order);
  const tax = Math.max(q.subtotal - q.discount, 0) * (q.tax_rate / 100);
  const email = document.body.dataset.email ?? 'devdesdeceromx@gmail.com';
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(q.folio)} · ${esc(q.title)}</title>
<style>
@page{size:letter;margin:16mm}*{box-sizing:border-box}body{font:13px/1.5 Inter,system-ui,sans-serif;color:#1d1d1f;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #d2d2d7;padding-bottom:18px}
.brand{display:flex;gap:10px;align-items:center;font:700 22px "Inter Tight",sans-serif;letter-spacing:-.03em}.brand svg{width:28px;height:28px}
.doc{text-align:right}.doc h1{font:700 20px "Inter Tight",sans-serif;margin:0;letter-spacing:-.02em}.doc p{margin:2px 0;color:#6e6e73}
.meta{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:22px 0}.meta small{display:block;color:#6e6e73;font-size:11px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px}
h2{font:700 18px "Inter Tight",sans-serif;margin:0 0 6px;letter-spacing:-.02em}.desc{color:#424245;white-space:pre-wrap;margin:0 0 18px}
table{width:100%;border-collapse:collapse}th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#6e6e73;border-bottom:1px solid #d2d2d7;padding:8px 6px}
td{padding:10px 6px;border-bottom:1px solid #ececf0;vertical-align:top}.r{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.tot{margin-left:auto;width:280px;margin-top:14px}.tot div{display:flex;justify-content:space-between;padding:4px 6px}.tot .big{border-top:2px solid #1d1d1f;margin-top:6px;padding-top:10px;font:700 18px "Inter Tight",sans-serif}
.notes{margin-top:28px;padding:14px 16px;background:#f5f5f7;border-radius:12px;white-space:pre-wrap}.foot{margin-top:36px;color:#6e6e73;font-size:11px;text-align:center}
</style></head><body>
<div class="top"><div class="brand"><svg viewBox="0 0 24 24"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#0a66ff"/><stop offset=".55" stop-color="#7b5cff"/><stop offset="1" stop-color="#ff5c8a"/></linearGradient></defs><ellipse cx="12" cy="12" rx="7.5" ry="10" fill="none" stroke="url(#g)" stroke-width="3"/></svg>DevDesdeCero</div>
<div class="doc"><h1>Cotización</h1><p>${esc(q.folio)}</p><p>${dayLabel(q.created_at.slice(0, 10))}</p></div></div>
<div class="meta"><div><small>Para</small><b>${esc(q.clients?.name ?? '')}</b><br>${esc(q.clients?.business ?? '')}${q.clients?.email ? '<br>' + esc(q.clients.email) : ''}${q.clients?.phone ? '<br>' + esc(q.clients.phone) : ''}</div>
<div><small>Vigencia</small>${q.valid_until ? 'Válida hasta el ' + dayLabel(q.valid_until) : '—'}</div></div>
<h2>${esc(q.title)}</h2>${q.description ? `<p class="desc">${esc(q.description)}</p>` : ''}
<table><thead><tr><th>Concepto</th><th class="r">Cant.</th><th class="r">Precio</th><th class="r">Importe</th></tr></thead><tbody>
${items.map((i) => `<tr><td>${esc(i.description)}</td><td class="r">${Number(i.quantity)}</td><td class="r">${money.format(i.unit_price)}</td><td class="r">${money.format(i.quantity * i.unit_price)}</td></tr>`).join('')}
</tbody></table>
<div class="tot"><div><span>Subtotal</span><span class="r">${money.format(q.subtotal)}</span></div>${q.discount ? `<div><span>Descuento</span><span class="r">−${money.format(q.discount)}</span></div>` : ''}${q.tax_rate ? `<div><span>IVA ${Number(q.tax_rate)}%</span><span class="r">${money.format(tax)}</span></div>` : ''}<div class="big"><span>Total</span><span class="r">${money.format(q.total)} MXN</span></div></div>
${q.notes ? `<div class="notes">${esc(q.notes)}</div>` : ''}
<p class="foot">DevDesdeCero · Planeación, diseño y desarrollo web · ${esc(email)}</p>
</body></html>`;
  // Se imprime desde un iframe oculto (sin ventanas emergentes); "Guardar como PDF" en el diálogo de impresión.
  document.getElementById('print-frame')?.remove();
  const f = document.createElement('iframe');
  f.id = 'print-frame';
  f.title = 'Cotización para imprimir';
  f.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0';
  f.srcdoc = html;
  f.onload = () => { const w = f.contentWindow!; w.document.title = `${q.folio} ${q.title}`; void w.document.fonts.ready.then(() => setTimeout(() => w.print(), 150)); };
  document.body.appendChild(f);
}

/* =============================== Proyectos =============================== */
let projects: Project[] = [];
async function loadProjects() {
  const { data, error } = await sb.from('projects').select('*, clients(name,business), project_tasks(id,done,due_date,title), project_payments(amount)').order('created_at', { ascending: false });
  if (error) return err('No se pudieron cargar los proyectos.');
  projects = data as Project[];
  renderProjects();
}
const paid = (p: Project) => (p.project_payments ?? []).reduce((a, x) => a + Number(x.amount), 0);
function renderProjects() {
  const st = $<HTMLSelectElement>('p-status').value;
  const open = (p: Project) => !['cerrado', 'cancelado', 'entregado'].includes(p.status);
  const list = projects.filter((p) => (st === 'abiertos' ? open(p) : !st || p.status === st));
  // Vencimientos: tareas y entregas atrasadas o en los próximos 7 días.
  const t = today(), week = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  const due: { label: string; date: string; pid: string }[] = [];
  projects.filter(open).forEach((p) => {
    if (p.due_date && p.due_date <= week) due.push({ label: `Entrega: ${p.name}`, date: p.due_date, pid: p.id });
    (p.project_tasks ?? []).forEach((k) => { if (!k.done && k.due_date && k.due_date <= week) due.push({ label: `${k.title} · ${p.name}`, date: k.due_date, pid: p.id }); });
  });
  due.sort((a, b) => a.date.localeCompare(b.date));
  $('due').innerHTML = due.length ? `<div class="card due"><h3>Próximos vencimientos</h3><ul>${due.slice(0, 8).map((d) => `<li data-open="${d.pid}" class="${d.date < t ? 'late' : ''}"><span>${esc(d.label)}</span><b>${d.date < t ? 'Atrasado · ' : ''}${fdShort(d.date)}</b></li>`).join('')}</ul></div>` : '';
  $('projects').innerHTML = list.length ? list.map((p) => {
    const tasks = p.project_tasks ?? [], done = tasks.filter((k) => k.done).length, pr = paid(p);
    return `<article class="card proj" data-open="${p.id}" tabindex="0">
      <header><div><h3>${esc(p.name)}</h3><p class="muted">${esc(p.folio)} · ${esc(p.clients?.name ?? '')}</p></div><span class="chip p-${p.status}">${PSTATUS[p.status]}</span></header>
      <div class="pbar"><span>Avance</span><b>${tasks.length ? Math.round((done / tasks.length) * 100) : 0}%</b><div class="bt"><i style="width:${tasks.length ? (done / tasks.length) * 100 : 0}%"></i></div><small>${done} de ${tasks.length} tareas</small></div>
      <div class="pbar"><span>Cobrado</span><b>${money.format(pr)}</b><div class="bt"><i class="money" style="width:${p.price ? Math.min(100, (pr / p.price) * 100) : 0}%"></i></div><small>de ${money.format(p.price)}</small></div>
      <p class="muted small">Entrega: ${dayLabel(p.due_date)}</p>
    </article>`;
  }).join('') : `<div class="card empty">${projects.length ? 'Nada con ese filtro.' : 'Aún no hay proyectos. Se crean al aceptar una cotización o desde aquí.'}</div>`;
}
const fdShort = (d: string) => new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(d));
$('p-status').addEventListener('change', renderProjects);
for (const id of ['projects', 'due']) {
  $(id).addEventListener('click', (e) => { const el = (e.target as HTMLElement).closest<HTMLElement>('[data-open]'); if (el) void openProject(el.dataset.open!); });
  $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') (e.target as HTMLElement).click(); });
}
$('add-project').addEventListener('click', async () => {
  if (!clients.length) await fetchClients();
  if (!clients.length) { showError('Primero agrega un cliente.'); nav.open('clientes'); return; }
  void openProject();
});

let current: Project | null = null;
async function openProject(id?: string) {
  if (!clients.length) await fetchClients();
  current = null;
  if (id) {
    const { data, error } = await sb.from('projects').select('*, clients(name,business), project_tasks(*), project_payments(*), project_expenses(*)').eq('id', id).single();
    if (error) return err('No se pudo abrir el proyecto.');
    current = data as Project;
  }
  const p = current;
  const f = $<HTMLFormElement>('project-form');
  f.reset();
  $('project-h').textContent = p ? `${p.folio} · ${p.name}` : 'Nuevo proyecto';
  (f.elements.namedItem('id') as HTMLInputElement).value = p?.id ?? '';
  (f.elements.namedItem('client_id') as HTMLSelectElement).innerHTML = clientOptions(p?.client_id);
  (f.elements.namedItem('status') as HTMLSelectElement).innerHTML = opts(PSTATUS, p?.status ?? 'preparacion');
  (['name', 'description', 'url', 'start_date', 'due_date'] as const).forEach((k) => ((f.elements.namedItem(k) as HTMLInputElement).value = (p?.[k] as string) ?? ''));
  (f.elements.namedItem('price') as HTMLInputElement).value = String(p?.price ?? '');
  $('p-extra').hidden = !p;
  if (p) renderProjectExtra(p);
  const d = dialog('project-dlg');
  if (!d.open) d.showModal();
}
function renderProjectExtra(p: Project) {
  const tasks = (p.project_tasks ?? []).sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title));
  $('p-tasks').innerHTML = tasks.map((k) => `<li data-task="${k.id}"><label class="check"><input type="checkbox"${k.done ? ' checked' : ''}/><span>${esc(k.title)}</span></label><small>${k.due_date ? fdShort(k.due_date) : ''}</small><button type="button" class="x" data-rm-task aria-label="Borrar tarea">×</button></li>`).join('') || '<li class="empty">Sin tareas todavía.</li>';
  const pays = (p.project_payments ?? []).sort((a, b) => b.paid_at.localeCompare(a.paid_at));
  const pr = pays.reduce((a, x) => a + Number(x.amount), 0);
  $('p-paysum').textContent = `${money.format(pr)} de ${money.format(p.price)} · saldo ${money.format(Math.max(p.price - pr, 0))}`;
  $('p-pays').innerHTML = pays.map((x) => `<li><span>${PAYKIND[x.kind]} · ${PAYMETHOD[x.method]}${x.reference ? ' · ' + esc(x.reference) : ''}</span><small>${fdShort(x.paid_at)}</small><b class="num">${money.format(x.amount)}</b></li>`).join('') || '<li class="empty">Sin pagos.</li>';
  const exps = (p.project_expenses ?? []).sort((a, b) => b.spent_at.localeCompare(a.spent_at));
  const ex = exps.reduce((a, x) => a + Number(x.amount), 0);
  $('p-expsum').textContent = `${money.format(ex)} · utilidad ${money.format(pr - ex)}`;
  $('p-exps').innerHTML = exps.map((x) => `<li><span>${esc(x.description)} · ${ECAT[x.category]}</span><small>${fdShort(x.spent_at)}</small><b class="num">${money.format(x.amount)}</b></li>`).join('') || '<li class="empty">Sin gastos.</li>';
  ($('pay-form').querySelector('[name=paid_at]') as HTMLInputElement).value = today();
  ($('exp-form').querySelector('[name=spent_at]') as HTMLInputElement).value = today();
  ($('pay-form').querySelector('[name=amount]') as HTMLInputElement).placeholder = `Saldo ${money.format(Math.max(p.price - pr, 0))}`;
}
async function refreshProject() { if (current) { await openProject(current.id); void loadProjects(); } }

$('project-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const v = formValues(e.target as HTMLFormElement);
  if (!v('name') || !v('client_id')) return showError('El proyecto necesita cliente y nombre.');
  const url = v('url');
  if (url && !/^https?:\/\//.test(url)) return showError('El enlace debe empezar con https://');
  const row = { client_id: v('client_id'), name: v('name'), description: v('description'), url, start_date: v('start_date'), due_date: v('due_date'), price: num(v('price')), status: v('status') ?? 'preparacion' };
  const id = v('id');
  const { data, error } = id ? await sb.from('projects').update(row).eq('id', id).select('id').single() : await sb.from('projects').insert(row).select('id').single();
  if (error) return err('No se pudo guardar el proyecto.', error);
  showError(null);
  flash($('p-ok'));
  void loadProjects();
  if (!id) void openProject(data.id);
});
$('task-form').addEventListener('submit', async (e) => {
  e.preventDefault(); if (!current) return;
  const v = formValues(e.target as HTMLFormElement);
  if (!v('title')) return;
  const { error } = await sb.from('project_tasks').insert({ project_id: current.id, title: v('title'), due_date: v('due_date'), sort_order: (current.project_tasks ?? []).length });
  if (error) return err('No se pudo agregar la tarea.');
  (e.target as HTMLFormElement).reset();
  void refreshProject();
});
$('p-tasks').addEventListener('change', async (e) => {
  const li = (e.target as HTMLElement).closest<HTMLElement>('[data-task]'); if (!li) return;
  const { error } = await sb.from('project_tasks').update({ done: (e.target as HTMLInputElement).checked }).eq('id', li.dataset.task!);
  if (error) return err('No se pudo actualizar la tarea.');
  void loadProjects();
});
$('p-tasks').addEventListener('click', async (e) => {
  if (!(e.target as HTMLElement).closest('[data-rm-task]')) return;
  const li = (e.target as HTMLElement).closest<HTMLElement>('[data-task]')!;
  const { error } = await sb.from('project_tasks').delete().eq('id', li.dataset.task!);
  if (error) return err('No se pudo borrar la tarea.');
  void refreshProject();
});
$('pay-form').addEventListener('submit', async (e) => {
  e.preventDefault(); if (!current) return;
  const v = formValues(e.target as HTMLFormElement);
  if (!num(v('amount'))) return showError('Escribe el monto del pago.');
  const { error } = await sb.from('project_payments').insert({ project_id: current.id, kind: v('kind'), amount: num(v('amount')), method: v('method'), paid_at: v('paid_at') ?? today(), reference: v('reference') });
  if (error) return err('No se pudo registrar el pago.', error);
  showError(null);
  (e.target as HTMLFormElement).reset();
  void refreshProject();
});
$('exp-form').addEventListener('submit', async (e) => {
  e.preventDefault(); if (!current) return;
  const v = formValues(e.target as HTMLFormElement);
  if (!num(v('amount')) || !v('description')) return showError('Escribe concepto y monto del gasto.');
  const { error } = await sb.from('project_expenses').insert({ project_id: current.id, category: v('category'), description: v('description'), amount: num(v('amount')), spent_at: v('spent_at') ?? today() });
  if (error) return err('No se pudo registrar el gasto.');
  showError(null);
  (e.target as HTMLFormElement).reset();
  void refreshProject();
});

/* =============================== Finanzas =============================== */
type Finance = { year: number; collected: number; expenses: number; pending: number; quoted_open: number; monthly: { m: number; in: number; out: number }[] };
let year = new Date().getFullYear();
const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
async function loadFinance() {
  $('f-year').textContent = String(year);
  const [{ data, error }, { data: exps }] = await Promise.all([
    sb.rpc('crm_finance', { p_year: year }),
    sb.from('project_expenses').select('*, projects(folio,name)').gte('spent_at', `${year}-01-01`).lte('spent_at', `${year}-12-31`).order('spent_at', { ascending: false }),
  ]);
  if (error) return err('No se pudieron cargar las finanzas.');
  const f = data as Finance;
  const profit = f.collected - f.expenses;
  $('f-kpis').innerHTML = [
    ['Cobrado', money.format(f.collected), `en ${year}`],
    ['Gastos', money.format(f.expenses), `en ${year}`],
    ['Utilidad', money.format(profit), f.collected ? `${Math.round((profit / f.collected) * 100)}% de margen` : '—'],
    ['Por cobrar', money.format(f.pending), `cotizado abierto ${money.format(f.quoted_open)}`],
  ].map(([k, v, d]) => `<div class="card kpi"><p class="k">${k}</p><p class="v sm">${v}</p><span class="d">${d}</span></div>`).join('');
  drawFinance(f.monthly);
  const list = (exps ?? []) as Expense[];
  $('f-exps').innerHTML = list.length ? `<table class="tbl"><thead><tr><th>Fecha</th><th>Concepto</th><th>Proyecto</th><th class="r">Monto</th></tr></thead><tbody>${list.map((x) => `<tr><td>${fdShort(x.spent_at)}</td><td>${esc(x.description)}<small>${ECAT[x.category]}</small></td><td>${esc(x.projects?.name ?? 'General')}</td><td class="r num">${money.format(x.amount)}</td></tr>`).join('')}</tbody></table>` : '<p class="empty">Sin gastos este año.</p>';
  ($('gexp-form').querySelector('[name=spent_at]') as HTMLInputElement).value = today();
}
function drawFinance(rows: Finance['monthly']) {
  const W = 720, H = 220, pl = 54, pr = 8, pt = 10, pb = 26;
  const max = Math.max(1000, ...rows.flatMap((r) => [r.in, r.out]));
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / step) * step;
  const y = (v: number) => pt + (H - pt - pb) * (1 - v / top);
  const gw = (W - pl - pr) / 12, bw = Math.min(16, (gw - 10) / 2);
  const short = new Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 1 });
  let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">`;
  [0, top / 2, top].forEach((v) => { s += `<line class="grid" x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${pl - 6}" y="${y(v) + 4}" text-anchor="end">$${short.format(v)}</text>`; });
  const bar = (x: number, v: number, cls: string) => {
    if (!v) return '';
    const by = y(v), base = H - pb, r = Math.min(4, bw / 2, base - by);
    return `<path class="${cls}" d="M${x},${base}V${by + r}Q${x},${by} ${x + r},${by}H${x + bw - r}Q${x + bw},${by} ${x + bw},${by + r}V${base}Z"/>`;
  };
  rows.forEach((r, i) => {
    const cx = pl + i * gw + gw / 2;
    s += bar(cx - bw - 1, r.in, 'bar') + bar(cx + 1, r.out, 'bar2');
    s += `<rect class="hit" data-i="${i}" x="${pl + i * gw}" y="${pt}" width="${gw}" height="${H - pt - pb}"/>`;
    s += `<text class="ax" x="${cx}" y="${H - 8}" text-anchor="middle">${MONTHS[i]}</text>`;
  });
  s += `<line class="base" x1="${pl}" x2="${W - pr}" y1="${H - pb}" y2="${H - pb}"/></svg>`;
  const box = $('f-chart');
  box.innerHTML = s;
  box.setAttribute('aria-label', `Cobrado y gastos por mes de ${year}.`);
  const tip = $('f-tip');
  box.querySelectorAll<SVGRectElement>('.hit').forEach((h) => {
    const on = () => {
      const r = rows[Number(h.dataset.i)];
      box.querySelectorAll('.hit').forEach((x) => x.classList.toggle('on', x === h));
      tip.innerHTML = `<b>${MONTHS[r.m - 1]} ${year}</b><span>Cobrado ${money.format(r.in)}</span><span>Gastos ${money.format(r.out)}</span><span>Utilidad ${money.format(r.in - r.out)}</span>`;
      tip.hidden = false;
      const br = box.getBoundingClientRect(), hr = h.getBoundingClientRect();
      tip.style.left = `${Math.min(br.width - tip.offsetWidth, Math.max(0, hr.left - br.left + hr.width / 2 - tip.offsetWidth / 2))}px`;
    };
    h.addEventListener('mouseenter', on); h.addEventListener('click', on);
  });
  box.onmouseleave = () => { tip.hidden = true; box.querySelectorAll('.hit').forEach((x) => x.classList.remove('on')); };
}
$('f-prev').addEventListener('click', () => { year--; void loadFinance(); });
$('f-next').addEventListener('click', () => { year++; void loadFinance(); });
$('gexp-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const v = formValues(e.target as HTMLFormElement);
  if (!num(v('amount')) || !v('description')) return showError('Escribe concepto y monto del gasto.');
  const { error } = await sb.from('project_expenses').insert({ project_id: null, category: v('category'), description: v('description'), amount: num(v('amount')), spent_at: v('spent_at') ?? today() });
  if (error) return err('No se pudo registrar el gasto.');
  showError(null);
  (e.target as HTMLFormElement).reset();
  void loadFinance();
});

// Rellena los selects fijos.
document.querySelectorAll<HTMLSelectElement>('select[data-opts]').forEach((s) => (s.innerHTML = opts({ ECAT, PAYKIND, PAYMETHOD }[s.dataset.opts as 'ECAT'] ?? {})));

tabLoaders.clientes = () => void loadClients();
tabLoaders.cotizaciones = () => void loadQuotes();
tabLoaders.proyectos = () => void loadProjects();
tabLoaders.finanzas = () => void loadFinance();
