-- CRM DevDesdeCero: clientes, cotizaciones, proyectos (tareas, pagos, gastos) y finanzas.
-- Basado en DCX Manager, simplificado para un solo administrador. Todo protegido con is_admin().

create or replace function public._touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;

-- ---------- Clientes ----------
create sequence public.client_folio_seq;
create table public.clients (
  id          uuid primary key default gen_random_uuid(),
  folio       text not null unique default ('CLI-' || lpad(nextval('public.client_folio_seq')::text, 4, '0')),
  lead_id     uuid unique references public.leads(id) on delete set null,
  name        text not null check (char_length(trim(name)) between 2 and 120),
  business    text check (char_length(business) <= 160),
  email       text check (char_length(email) <= 160),
  phone       text check (char_length(phone) <= 30),
  address     text check (char_length(address) <= 300),
  notes       text check (char_length(notes) <= 4000),
  status      text not null default 'activo' check (status in ('activo','inactivo')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- Cotizaciones ----------
create sequence public.quote_folio_seq;
create table public.quotes (
  id          uuid primary key default gen_random_uuid(),
  folio       text not null unique default ('COT-' || lpad(nextval('public.quote_folio_seq')::text, 4, '0')),
  client_id   uuid not null references public.clients(id) on delete restrict,
  title       text not null check (char_length(trim(title)) between 2 and 160),
  description text check (char_length(description) <= 4000),
  status      text not null default 'borrador' check (status in ('borrador','enviada','negociacion','aceptada','rechazada','vencida')),
  subtotal    numeric(12,2) not null default 0,
  discount    numeric(12,2) not null default 0 check (discount >= 0),
  tax_rate    numeric(5,2) not null default 0 check (tax_rate between 0 and 100),
  total       numeric(12,2) not null default 0,
  valid_until date,
  notes       text check (char_length(notes) <= 4000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create table public.quote_items (
  id          uuid primary key default gen_random_uuid(),
  quote_id    uuid not null references public.quotes(id) on delete cascade,
  description text not null check (char_length(trim(description)) between 1 and 500),
  quantity    numeric(10,2) not null default 1 check (quantity > 0),
  unit_price  numeric(12,2) not null default 0 check (unit_price >= 0),
  sort_order  integer not null default 0
);
create index quote_items_quote_idx on public.quote_items (quote_id, sort_order);

-- Recalcula subtotal y total (subtotal - descuento + IVA sobre lo restante).
create or replace function public.recalc_quote(p_quote uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_sub numeric;
begin
  select coalesce(sum(quantity * unit_price), 0) into v_sub from public.quote_items where quote_id = p_quote;
  update public.quotes q
     set subtotal = v_sub,
         total = round(greatest(v_sub - q.discount, 0) * (1 + q.tax_rate / 100), 2)
   where q.id = p_quote;
end; $$;
create or replace function public._recalc_quote_from_items()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then perform public.recalc_quote(old.quote_id);
  else perform public.recalc_quote(new.quote_id); end if;
  return null;
end; $$;
create or replace function public._recalc_quote_from_quote()
returns trigger language plpgsql security definer set search_path = '' as $$
begin perform public.recalc_quote(new.id); return null; end; $$;
create trigger quote_items_recalc after insert or update or delete on public.quote_items for each row execute function public._recalc_quote_from_items();
create trigger quotes_recalc after insert or update of discount, tax_rate on public.quotes for each row execute function public._recalc_quote_from_quote();

-- ---------- Proyectos ----------
create sequence public.project_folio_seq;
create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  folio       text not null unique default ('PRY-' || lpad(nextval('public.project_folio_seq')::text, 4, '0')),
  client_id   uuid not null references public.clients(id) on delete restrict,
  quote_id    uuid unique references public.quotes(id) on delete set null,
  name        text not null check (char_length(trim(name)) between 2 and 160),
  description text check (char_length(description) <= 4000),
  url         text check (url is null or url ~ '^https?://'),
  start_date  date,
  due_date    date,
  price       numeric(12,2) not null default 0 check (price >= 0),
  status      text not null default 'preparacion' check (status in ('preparacion','espera_anticipo','desarrollo','revision','entregado','garantia','cerrado','pausado','cancelado')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.project_tasks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  title       text not null check (char_length(trim(title)) between 1 and 200),
  done        boolean not null default false,
  due_date    date,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index project_tasks_project_idx on public.project_tasks (project_id, sort_order);
create index project_tasks_due_idx on public.project_tasks (due_date) where not done;

create table public.project_payments (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete restrict,
  kind        text not null check (kind in ('anticipo','parcial','final')),
  amount      numeric(12,2) not null check (amount > 0),
  method      text not null check (method in ('transferencia','efectivo','tarjeta','otro')),
  paid_at     date not null default current_date,
  reference   text check (char_length(reference) <= 160),
  created_at  timestamptz not null default now()
);
create index project_payments_project_idx on public.project_payments (project_id);
create index project_payments_paid_idx on public.project_payments (paid_at desc);

create table public.project_expenses (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references public.projects(id) on delete restrict,
  category    text not null check (category in ('herramientas','hosting','dominio','licencias','colaboradores','publicidad','impuestos','otro')),
  description text not null check (char_length(trim(description)) between 1 and 300),
  amount      numeric(12,2) not null check (amount > 0),
  spent_at    date not null default current_date,
  created_at  timestamptz not null default now()
);
create index project_expenses_project_idx on public.project_expenses (project_id);
create index project_expenses_spent_idx on public.project_expenses (spent_at desc);

-- Un pago no puede superar el precio del proyecto; el anticipo arranca el proyecto.
create or replace function public._check_payment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_price numeric; v_paid numeric;
begin
  select price into v_price from public.projects where id = new.project_id for update;
  select coalesce(sum(amount), 0) into v_paid from public.project_payments where project_id = new.project_id and id <> new.id;
  if v_paid + new.amount > v_price then
    raise exception 'El pago supera el saldo pendiente';
  end if;
  if tg_op = 'INSERT' and new.kind = 'anticipo' then
    update public.projects set status = 'desarrollo' where id = new.project_id and status = 'espera_anticipo';
  end if;
  return new;
end; $$;
create trigger project_payments_check before insert or update on public.project_payments for each row execute function public._check_payment();

create trigger clients_touch before update on public.clients for each row execute function public._touch_updated_at();
create trigger quotes_touch before update on public.quotes for each row execute function public._touch_updated_at();
create trigger projects_touch before update on public.projects for each row execute function public._touch_updated_at();

-- ---------- Acciones ----------
-- Contacto del sitio → cliente.
create or replace function public.convert_lead_to_client(p_lead uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare l public.leads; v_id uuid;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  select id into v_id from public.clients where lead_id = p_lead;
  if v_id is not null then return v_id; end if;
  select * into l from public.leads where id = p_lead;
  if l.id is null then raise exception 'Contacto no encontrado'; end if;
  insert into public.clients (lead_id, name, business, email, phone, notes)
  values (l.id, l.name, l.business, l.email, l.phone, nullif(concat_ws(E'\n\n', l.message, l.notes), ''))
  returning id into v_id;
  update public.leads set status = 'ganado', updated_at = now() where id = l.id;
  return v_id;
end; $$;

-- Cotización aceptada → proyecto (esperando anticipo).
create or replace function public.accept_quote(p_quote uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare q public.quotes; v_id uuid;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  select id into v_id from public.projects where quote_id = p_quote;
  if v_id is not null then return v_id; end if;
  select * into q from public.quotes where id = p_quote for update;
  if q.id is null then raise exception 'Cotización no encontrada'; end if;
  update public.quotes set status = 'aceptada' where id = q.id;
  insert into public.projects (client_id, quote_id, name, description, price, status)
  values (q.client_id, q.id, q.title, q.description, q.total, 'espera_anticipo')
  returning id into v_id;
  return v_id;
end; $$;

-- Finanzas del año: cobrado, gastos y utilidad por mes, más saldo pendiente.
create or replace function public.crm_finance(p_year integer default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_year integer := coalesce(p_year, extract(year from now())::int);
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  return jsonb_build_object(
    'year', v_year,
    'collected', (select coalesce(sum(amount), 0) from public.project_payments where extract(year from paid_at) = v_year),
    'expenses', (select coalesce(sum(amount), 0) from public.project_expenses where extract(year from spent_at) = v_year),
    'pending', (select coalesce(sum(p.price - coalesce(pay.s, 0)), 0) from public.projects p
                left join (select project_id, sum(amount) s from public.project_payments group by 1) pay on pay.project_id = p.id
                where p.status not in ('cancelado')),
    'quoted_open', (select coalesce(sum(total), 0) from public.quotes where status in ('borrador','enviada','negociacion')),
    'monthly', (
      select jsonb_agg(jsonb_build_object('m', m,
        'in', coalesce((select sum(amount) from public.project_payments where extract(year from paid_at) = v_year and extract(month from paid_at) = m), 0),
        'out', coalesce((select sum(amount) from public.project_expenses where extract(year from spent_at) = v_year and extract(month from spent_at) = m), 0)) order by m)
      from generate_series(1, 12) m
    )
  );
end; $$;

-- ---------- Seguridad ----------
alter table public.clients enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.projects enable row level security;
alter table public.project_tasks enable row level security;
alter table public.project_payments enable row level security;
alter table public.project_expenses enable row level security;

do $$
declare t text;
begin
  foreach t in array array['clients','quotes','quote_items','projects','project_tasks','project_payments','project_expenses'] loop
    execute format('revoke all on public.%I from anon', t);
    if t <> 'quotes' then
      execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    end if;
    execute format('create policy %I on public.%I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t || '_admin_all', t);
  end loop;
end $$;
-- Subtotal y total solo los calcula la base de datos.
grant select, insert, delete on public.quotes to authenticated;
grant update (client_id, title, description, status, discount, tax_rate, valid_until, notes) on public.quotes to authenticated;
grant usage, select on sequence public.client_folio_seq, public.quote_folio_seq, public.project_folio_seq to authenticated;

revoke execute on function public._touch_updated_at(), public.recalc_quote(uuid), public._recalc_quote_from_items(), public._recalc_quote_from_quote(), public._check_payment() from public, anon, authenticated;
revoke execute on function public.convert_lead_to_client(uuid), public.accept_quote(uuid), public.crm_finance(integer) from public, anon;
grant execute on function public.convert_lead_to_client(uuid), public.accept_quote(uuid), public.crm_finance(integer) to authenticated;
