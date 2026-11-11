-- DevDesdeCero · dashboard privado (/admin)
-- Solo los correos en admin_users, con cuenta confirmada en Supabase Auth,
-- pueden leer contactos y estadísticas y editar textos/redes.

create table public.admin_users (
  email      text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;

insert into public.admin_users (email) values ('devdesdeceromx@gmail.com');

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    join public.admin_users a on a.email = lower(u.email)
    where u.id = auth.uid() and u.email_confirmed_at is not null
  );
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Contactos como embudo de ventas (etapas y origen rescatados de DCX Manager).
alter table public.leads drop constraint leads_status_check;
update public.leads set status = case status when 'en_proceso' then 'negociacion' when 'cerrado' then 'ganado' when 'descartado' then 'perdido' else status end;
alter table public.leads add constraint leads_status_check
  check (status in ('nuevo','contactado','calificado','cotizacion','negociacion','ganado','perdido'));
alter table public.leads add column source text not null default 'sitio'
  check (source in ('sitio','whatsapp','facebook','instagram','tiktok','recomendacion','cliente','directo','otro'));
alter table public.leads alter column email drop not null;
alter table public.leads add constraint leads_contact_check check (email is not null or phone is not null);
alter table public.leads add column updated_at timestamptz not null default now();

-- Contactos: ver, agregar a mano (WhatsApp, recomendación…), cambiar etapa/notas y borrar.
grant select, delete on public.leads to authenticated;
grant insert (name, email, phone, business, project_type, message, lang, source, status, notes) on public.leads to authenticated;
grant update (name, email, phone, business, project_type, message, source, status, notes, updated_at) on public.leads to authenticated;
create policy leads_admin_insert on public.leads for insert to authenticated with check ((select public.is_admin()));
create policy leads_admin_select on public.leads for select to authenticated using ((select public.is_admin()));
create policy leads_admin_update on public.leads for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy leads_admin_delete on public.leads for delete to authenticated using ((select public.is_admin()));

-- Analítica: solo lectura.
grant select on public.site_events, public.site_stats to authenticated;
create policy events_admin_select on public.site_events for select to authenticated using ((select public.is_admin()));

-- Textos editables.
grant select, insert, update, delete on public.site_texts to authenticated;
create policy texts_admin_all on public.site_texts for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- Correo y redes.
grant select, update on public.site_settings to authenticated;
create policy settings_admin_select on public.site_settings for select to authenticated using ((select public.is_admin()));
create policy settings_admin_update on public.site_settings for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- Validación de redes: solo enlaces https.
alter table public.site_settings
  add constraint site_settings_urls_https check (
    coalesce(facebook_url, 'https://') ~ '^https://' and coalesce(instagram_url, 'https://') ~ '^https://'
    and coalesce(tiktok_url, 'https://') ~ '^https://' and coalesce(youtube_url, 'https://') ~ '^https://'
    and coalesce(linkedin_url, 'https://') ~ '^https://'
  );

-- Resumen de analítica para el dashboard (últimos N días).
create or replace function public.admin_stats(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days integer := least(greatest(coalesce(p_days, 30), 1), 365);
  v_from timestamptz := date_trunc('day', now()) - make_interval(days => v_days - 1);
  v_prev timestamptz := v_from - make_interval(days => v_days);
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;

  return jsonb_build_object(
    'days', v_days,
    'totals', (
      select jsonb_build_object(
        'visits', count(*) filter (where event = 'page_view' and created_at >= v_from),
        'visitors', count(distinct visitor_id) filter (where event = 'page_view' and created_at >= v_from),
        'prev_visits', count(*) filter (where event = 'page_view' and created_at < v_from),
        'prev_visitors', count(distinct visitor_id) filter (where event = 'page_view' and created_at < v_from)
      ) from public.site_events where created_at >= v_prev
    ) || (
      select jsonb_build_object(
        'leads', count(*) filter (where created_at >= v_from),
        'prev_leads', count(*) filter (where created_at < v_from),
        'new_leads', (select count(*) from public.leads where status = 'nuevo')
      ) from public.leads where created_at >= v_prev
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'visits', coalesce(e.visits, 0), 'leads', coalesce(l.leads, 0)) order by d.day), '[]'::jsonb)
      from (select generate_series(v_from, date_trunc('day', now()), interval '1 day')::date as day) d
      left join (select created_at::date as day, count(*) as visits from public.site_events where event = 'page_view' and created_at >= v_from group by 1) e using (day)
      left join (select created_at::date as day, count(*) as leads from public.leads where created_at >= v_from group by 1) l using (day)
    ),
    'sources', (
      select coalesce(jsonb_agg(jsonb_build_object('label', label, 'n', n) order by n desc), '[]'::jsonb) from (
        select coalesce(nullif(utm_source, ''), nullif(referrer, ''), 'Directo') as label, count(*) as n
        from public.site_events where event = 'page_view' and created_at >= v_from group by 1 order by 2 desc limit 8
      ) s
    ),
    'devices', (
      select coalesce(jsonb_agg(jsonb_build_object('label', label, 'n', n) order by n desc), '[]'::jsonb) from (
        select coalesce(device, 'otro') as label, count(*) as n
        from public.site_events where event = 'page_view' and created_at >= v_from group by 1
      ) s
    ),
    'pipeline', (
      select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (
        select status, count(*) as n from public.leads group by 1
      ) s
    ),
    'browsers', (
      select coalesce(jsonb_agg(jsonb_build_object('label', label, 'n', n) order by n desc), '[]'::jsonb) from (
        select coalesce(browser, 'Otro') as label, count(*) as n
        from public.site_events where event = 'page_view' and created_at >= v_from group by 1 order by 2 desc limit 6
      ) s
    ),
    'langs', (
      select coalesce(jsonb_agg(jsonb_build_object('label', label, 'n', n) order by n desc), '[]'::jsonb) from (
        select coalesce(lang, '?') as label, count(*) as n
        from public.site_events where event = 'page_view' and created_at >= v_from group by 1
      ) s
    )
  );
end;
$$;
revoke execute on function public.admin_stats(integer) from public, anon;
grant execute on function public.admin_stats(integer) to authenticated;
