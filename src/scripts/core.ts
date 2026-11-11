// Utilidades compartidas del CRM (sesión de Supabase, DOM y formatos).
import { createClient } from '@supabase/supabase-js';

export const body = document.body.dataset;
if (!body.sbUrl || !body.sbKey) {
  document.getElementById('loading')!.textContent = 'Falta configurar Supabase (PUBLIC_SUPABASE_URL y PUBLIC_SUPABASE_PUBLISHABLE_KEY).';
  throw new Error('Supabase no configurado');
}
export const sb = createClient(body.sbUrl, body.sbKey, { auth: { persistSession: true, autoRefreshToken: true } });

export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export const fmt = new Intl.NumberFormat('es-MX');
export const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 });
export const fdate = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
export const fday = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' });
export const flong = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
export const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export function showError(msg: string | null) {
  const el = $('g-err');
  el.textContent = msg ?? '';
  el.hidden = !msg;
}
export function flash(el: HTMLElement | null) { if (!el) return; el.hidden = false; setTimeout(() => (el.hidden = true), 2200); }

// Cada módulo registra qué hacer al abrir su pestaña.
export const tabLoaders: Record<string, () => void> = {};
export const nav = { open: (_name: string) => {} };

// Lee los campos de un formulario como texto recortado (vacío → null).
export function formValues(form: HTMLFormElement) {
  const fd = new FormData(form);
  return (k: string) => String(fd.get(k) ?? '').trim() || null;
}
export const num = (v: string | null) => (v == null || v === '' ? 0 : Number(v));
