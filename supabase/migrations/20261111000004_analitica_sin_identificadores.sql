-- DevDesdeCero · analítica sin identificadores guardados en el navegador
-- El sitio ya no guarda un ID en localStorage/sessionStorage. El servidor agrupa
-- las visitas de un mismo día con un hash de IP + navegador + sal diaria aleatoria.
-- La IP no se guarda y las sales de días anteriores se borran, así que el hash
-- no se puede revertir ni enlazar entre días. No requiere banner de cookies.

create table if not exists public._analytics_salts (
  day   date primary key,
  salt  text not null
);
alter table public._analytics_salts enable row level security;
revoke all on public._analytics_salts from anon, authenticated;

create or replace function public._daily_visitor_id()
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  headers json;
  ip text := '';
  ua text := '';
  v_salt text;
begin
  begin
    headers := current_setting('request.headers', true)::json;
    ip := trim(split_part(coalesce(headers ->> 'x-forwarded-for', headers ->> 'x-real-ip', ''), ',', 1));
    ua := coalesce(headers ->> 'user-agent', '');
  exception when others then
    null;
  end;

  delete from public._analytics_salts where day < current_date;
  insert into public._analytics_salts (day, salt)
  values (current_date, encode(extensions.gen_random_bytes(32), 'hex'))
  on conflict (day) do nothing;
  select salt into v_salt from public._analytics_salts where day = current_date;

  return encode(substring(extensions.digest(v_salt || '|' || ip || '|' || ua, 'sha256') from 1 for 16), 'hex')::uuid;
end;
$$;
revoke all on function public._daily_visitor_id() from public, anon, authenticated;

-- Misma firma que antes (compatible con la versión anterior del sitio);
-- los IDs que mande el navegador se ignoran.
create or replace function public.track_event(
  p_event text,
  p_visitor_id uuid default null,
  p_session_id uuid default null,
  p_path text default null,
  p_lang text default null,
  p_referrer text default null,
  p_utm_source text default null,
  p_utm_medium text default null,
  p_utm_campaign text default null,
  p_device text default null,
  p_browser text default null,
  p_os text default null,
  p_screen_width integer default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_event not in ('page_view', 'lead') then return; end if;
  v_id := public._daily_visitor_id();

  -- Una visita por persona cada 30 minutos.
  if p_event = 'page_view' and exists (
    select 1 from public.site_events
    where session_id = v_id and event = 'page_view' and created_at > now() - interval '30 minutes'
  ) then return; end if;
  -- Máximo 50 eventos por persona al día (evita inflar números).
  if (select count(*) from public.site_events where session_id = v_id and created_at > now() - interval '1 day') >= 50 then
    return;
  end if;

  insert into public.site_events (event, visitor_id, session_id, path, lang, referrer, utm_source, utm_medium, utm_campaign, device, browser, os, screen_width)
  values (
    p_event, v_id, v_id,
    left(p_path, 200), left(p_lang, 5), left(p_referrer, 200),
    left(p_utm_source, 100), left(p_utm_medium, 100), left(p_utm_campaign, 100),
    left(p_device, 20), left(p_browser, 20), left(p_os, 20),
    case when p_screen_width between 0 and 10000 then p_screen_width end
  );
end;
$$;
grant execute on function public.track_event(text, uuid, uuid, text, text, text, text, text, text, text, text, text, integer) to anon, authenticated;
