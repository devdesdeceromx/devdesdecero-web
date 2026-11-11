-- DevDesdeCero · sitio público
-- Contactos (formulario anti-spam), analítica propia y textos editables.
-- Las tablas tienen RLS sin políticas públicas: el navegador solo puede llamar
-- a las funciones de abajo (security definer) con la clave publicable.

create extension if not exists pgcrypto with schema extensions;

-- =========================================================
-- 1. Contactos del formulario
-- =========================================================
create table public.leads (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  name          text not null check (char_length(name) between 2 and 80),
  email         text not null check (char_length(email) <= 160),
  phone         text check (char_length(phone) <= 30),
  business      text check (char_length(business) <= 160),
  project_type  text not null check (project_type in ('Landing page','Sitio completo','A medida','Rediseño','No sé')),
  message       text not null check (char_length(message) between 2 and 2000),
  lang          text not null check (lang in ('es','en')),
  page          text check (char_length(page) <= 200),
  ip_hash       text,
  status        text not null default 'nuevo' check (status in ('nuevo','contactado','en_proceso','cerrado','descartado')),
  notes         text
);
create index leads_created_at_idx on public.leads (created_at desc);
create index leads_email_idx on public.leads (lower(email), created_at desc);
create index leads_ip_idx on public.leads (ip_hash, created_at desc);
alter table public.leads enable row level security;

-- Hash de la IP del visitante (no se guarda la IP en claro).
create or replace function public._request_ip_hash()
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  headers json;
  ip text;
begin
  begin
    headers := current_setting('request.headers', true)::json;
  exception when others then
    return null;
  end;
  ip := split_part(coalesce(headers ->> 'x-forwarded-for', headers ->> 'x-real-ip', ''), ',', 1);
  if ip = '' then return null; end if;
  return encode(extensions.digest(trim(ip) || ':ddc', 'sha256'), 'hex');
end;
$$;

create or replace function public.submit_lead(
  p_name text,
  p_email text,
  p_project_type text,
  p_message text,
  p_lang text default 'es',
  p_phone text default null,
  p_business text default null,
  p_page text default null,
  p_hp text default null,
  p_elapsed_ms integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_name text := trim(coalesce(p_name, ''));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
  v_business text := nullif(trim(coalesce(p_business, '')), '');
  v_message text := trim(coalesce(p_message, ''));
  v_ip text := public._request_ip_hash();
begin
  -- Trampas anti-bots: campo oculto lleno o envío en menos de 3 segundos.
  if nullif(trim(coalesce(p_hp, '')), '') is not null or coalesce(p_elapsed_ms, 0) < 3000 then
    raise exception 'Solicitud no válida';
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'El nombre debe tener entre 2 y 80 caracteres';
  end if;
  if char_length(v_email) > 160 or v_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'El correo no es válido';
  end if;
  if v_phone is not null and (char_length(v_phone) > 30 or v_phone !~ '^[0-9+()\-. ]+$') then
    raise exception 'El teléfono no es válido';
  end if;
  if char_length(v_message) < 2 or char_length(v_message) > 2000 then
    raise exception 'El mensaje debe tener entre 2 y 2000 caracteres';
  end if;
  if v_business is not null and char_length(v_business) > 160 then
    raise exception 'El nombre del negocio es muy largo';
  end if;
  if p_lang not in ('es', 'en') then
    raise exception 'Idioma no válido';
  end if;
  if p_project_type not in ('Landing page','Sitio completo','A medida','Rediseño','No sé') then
    raise exception 'Tipo de proyecto no válido';
  end if;

  -- Límite de envíos en el servidor: 1 por minuto y 5 por día por correo o por IP.
  if exists (
    select 1 from public.leads
    where (lower(email) = v_email or (v_ip is not null and ip_hash = v_ip))
      and created_at > now() - interval '1 minute'
  ) then
    raise exception 'Espera un momento antes de enviar otro mensaje';
  end if;
  if (
    select count(*) from public.leads
    where (lower(email) = v_email or (v_ip is not null and ip_hash = v_ip))
      and created_at > now() - interval '1 day'
  ) >= 5 then
    raise exception 'Espera un momento antes de enviar otro mensaje';
  end if;

  insert into public.leads (name, email, phone, business, project_type, message, lang, page, ip_hash)
  values (v_name, v_email, v_phone, v_business, p_project_type, v_message, p_lang, left(p_page, 200), v_ip)
  returning id into v_id;

  return v_id;
end;
$$;

-- =========================================================
-- 2. Analítica propia
-- =========================================================
create table public.site_events (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  event         text not null check (event in ('page_view','lead')),
  visitor_id    uuid not null,
  session_id    uuid not null,
  path          text,
  lang          text,
  referrer      text,
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  device        text,
  browser       text,
  os            text,
  screen_width  integer
);
create index site_events_created_at_idx on public.site_events (created_at desc);
create index site_events_session_idx on public.site_events (session_id, event, created_at desc);
alter table public.site_events enable row level security;

create or replace function public.track_event(
  p_event text,
  p_visitor_id uuid,
  p_session_id uuid,
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
begin
  if p_event not in ('page_view', 'lead') then return; end if;
  -- Una visita por sesión cada 30 minutos.
  if p_event = 'page_view' and exists (
    select 1 from public.site_events
    where session_id = p_session_id and event = 'page_view' and created_at > now() - interval '30 minutes'
  ) then return; end if;
  -- Máximo 50 eventos por sesión al día (evita inflar números).
  if (select count(*) from public.site_events where session_id = p_session_id and created_at > now() - interval '1 day') >= 50 then
    return;
  end if;

  insert into public.site_events (event, visitor_id, session_id, path, lang, referrer, utm_source, utm_medium, utm_campaign, device, browser, os, screen_width)
  values (
    p_event, p_visitor_id, p_session_id,
    left(p_path, 200), left(p_lang, 5), left(p_referrer, 200),
    left(p_utm_source, 100), left(p_utm_medium, 100), left(p_utm_campaign, 100),
    left(p_device, 20), left(p_browser, 20), left(p_os, 20),
    case when p_screen_width between 0 and 10000 then p_screen_width end
  );
end;
$$;

-- Resumen para consultar desde el panel de Supabase: select * from public.site_stats;
create or replace view public.site_stats
with (security_invoker = true) as
select
  date_trunc('day', created_at)::date as dia,
  count(*) filter (where event = 'page_view') as visitas,
  count(distinct visitor_id) filter (where event = 'page_view') as visitantes,
  count(*) filter (where event = 'lead') as contactos,
  count(*) filter (where event = 'page_view' and device = 'mobile') as visitas_celular
from public.site_events
group by 1
order by 1 desc;

-- =========================================================
-- 3. Textos y redes editables
-- =========================================================
create table public.site_texts (
  key         text not null,
  lang        text not null check (lang in ('es','en')),
  value       text not null check (char_length(value) <= 1000),
  updated_at  timestamptz not null default now(),
  primary key (key, lang)
);
alter table public.site_texts enable row level security;

create table public.site_settings (
  id          boolean primary key default true check (id),
  contact_email text not null default 'devdesdeceromx@gmail.com',
  facebook_url  text,
  instagram_url text,
  tiktok_url    text,
  youtube_url   text,
  linkedin_url  text,
  updated_at  timestamptz not null default now()
);
alter table public.site_settings enable row level security;
insert into public.site_settings (id) values (true);

create or replace function public.get_site_content(p_lang text default 'es')
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'texts', coalesce((select jsonb_object_agg(key, value) from public.site_texts where lang = p_lang), '{}'::jsonb),
    'email', s.contact_email,
    'socials', jsonb_strip_nulls(jsonb_build_object(
      'Facebook', s.facebook_url, 'Instagram', s.instagram_url, 'TikTok', s.tiktok_url,
      'YouTube', s.youtube_url, 'LinkedIn', s.linkedin_url))
  )
  from public.site_settings s
  where s.id;
$$;

-- =========================================================
-- Permisos: el público solo ejecuta estas tres funciones.
-- =========================================================
revoke all on public.leads, public.site_events, public.site_texts, public.site_settings from anon, authenticated;
revoke all on public.site_stats from anon, authenticated;
revoke execute on function public._request_ip_hash() from public, anon, authenticated;

revoke execute on function public.submit_lead(text,text,text,text,text,text,text,text,text,integer) from public;
grant execute on function public.submit_lead(text,text,text,text,text,text,text,text,text,integer) to anon, authenticated;

revoke execute on function public.track_event(text,uuid,uuid,text,text,text,text,text,text,text,text,text,integer) from public;
grant execute on function public.track_event(text,uuid,uuid,text,text,text,text,text,text,text,text,text,integer) to anon, authenticated;

revoke execute on function public.get_site_content(text) from public;
grant execute on function public.get_site_content(text) to anon, authenticated;
