// Cliente mínimo para las funciones públicas (RPC) de Supabase.
// Solo usa la clave publicable; las tablas no son accesibles directamente (RLS sin políticas públicas).
const url = (document.body.dataset.sbUrl ?? '').replace(/\/$/, '');
const key = document.body.dataset.sbKey ?? '';

export const supabaseReady = Boolean(url && key);

export async function rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
    keepalive: true,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.message ?? `Error ${res.status}`);
  return data as T;
}
