-- LTD Sandy Shores — Base Supabase V7
-- Compatible avec une installation V1 : ce script ajoute/actualise les colonnes et règles nécessaires.
-- Supabase > SQL Editor > New query > coller tout ce fichier > Run.

create extension if not exists pgcrypto;

-- =========================
-- TABLES
-- =========================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'customer',
  loyalty_points integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists phone text default '';
alter table public.profiles add column if not exists favorite_address text default '';
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('customer','employee','manager','admin'));
alter table public.profiles drop constraint if exists profiles_loyalty_points_check;
alter table public.profiles add constraint profiles_loyalty_points_check check (loyalty_points >= 0);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text default '',
  price numeric(12,2) not null default 0,
  category text not null default 'Divers',
  emoji text default '🛒',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.products add column if not exists available boolean not null default true;
alter table public.products add column if not exists stock integer;
alter table public.products add column if not exists popular boolean not null default false;
alter table public.products add column if not exists is_new boolean not null default false;
alter table public.products drop constraint if exists products_stock_check;
alter table public.products add constraint products_stock_check check (stock is null or stock >= 0);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  type text not null default 'news',
  featured boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.announcements drop constraint if exists announcements_type_check;
alter table public.announcements add constraint announcements_type_check check (type in ('news','recruitment','alert','promotion'));

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  name text not null,
  phone text not null,
  sort_order integer not null default 0,
  active boolean not null default true
);

create table if not exists public.site_settings (
  id text primary key default 'main',
  business_name text not null default 'LTD Sandy Shores',
  address text not null default 'Route 68 — Sandy Shores, Blaine County',
  phone text not null default 'À renseigner',
  delivery_fee numeric(12,2) not null default 100,
  delivery_eta_min integer not null default 10,
  delivery_eta_max integer not null default 20,
  min_order numeric(12,2) not null default 0,
  loyalty_reward_points integer not null default 100,
  points_per_order integer not null default 10,
  recruitment_day text not null default 'Dimanche',
  business_open boolean not null default true,
  hours_text text not null default 'Ouvert selon les disponibilités de l''équipe',
  pickup_enabled boolean not null default true,
  delivery_enabled boolean not null default true,
  announcement_banner text default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text,
  discount_type text not null check (discount_type in ('percent','fixed','free_delivery')),
  value numeric(12,2) not null default 0,
  min_subtotal numeric(12,2) not null default 0,
  auto_apply boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists promotions_code_unique on public.promotions (upper(code)) where code is not null;

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete set null,
  applicant_name text not null,
  phone text not null,
  message text default '',
  status text not null default 'new' check (status in ('new','reviewed','accepted','rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.partnership_requests (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  contact_name text not null,
  phone text not null,
  partnership_type text not null default 'Autre',
  message text not null default '',
  status text not null default 'new' check (status in ('new','reviewed','accepted','rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  customer_name text,
  delivery_address text not null,
  note text default '',
  subtotal numeric(12,2) not null default 0,
  delivery_fee numeric(12,2) not null default 100,
  total numeric(12,2) not null default 0,
  status text not null default 'pending',
  used_loyalty_reward boolean not null default false,
  loyalty_awarded boolean not null default false,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.orders add column if not exists public_code text;
alter table public.orders add column if not exists customer_phone text default '';
alter table public.orders add column if not exists fulfillment text not null default 'delivery';
alter table public.orders add column if not exists discount numeric(12,2) not null default 0;
alter table public.orders add column if not exists promotion_id uuid references public.promotions(id) on delete set null;
alter table public.orders add column if not exists assigned_to uuid references public.profiles(id) on delete set null;
alter table public.orders add column if not exists assigned_name text;
alter table public.orders add column if not exists assigned_at timestamptz;
alter table public.orders add column if not exists eta_min integer;
alter table public.orders add column if not exists eta_max integer;
alter table public.orders add column if not exists cancelled_reason text;
alter table public.orders add column if not exists loyalty_refunded boolean not null default false;
alter table public.orders add column if not exists stock_restocked boolean not null default false;
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (status in ('pending','accepted','preparing','ready','out_for_delivery','delivered','cancelled'));
alter table public.orders drop constraint if exists orders_fulfillment_check;
alter table public.orders add constraint orders_fulfillment_check check (fulfillment in ('delivery','pickup'));
create unique index if not exists orders_public_code_unique on public.orders(public_code) where public_code is not null;

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price numeric(12,2) not null,
  quantity integer not null check (quantity > 0),
  line_total numeric(12,2) not null
);

create table if not exists public.loyalty_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  points integer not null,
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_name text,
  note text default '',
  created_at timestamptz not null default now()
);

-- Désactive les anciens triggers de la V1 : la V2 calcule tout dans ses fonctions sécurisées.
drop trigger if exists trg_prepare_order on public.orders;
drop trigger if exists trg_recalculate_order_total on public.order_items;
drop trigger if exists trg_award_loyalty on public.orders;

insert into public.site_settings(id) values ('main') on conflict (id) do nothing;

-- =========================
-- AUTH / HELPERS
-- =========================
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles (id, display_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'phone','')
  )
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role in ('employee','manager','admin'));
$$;
create or replace function public.is_direction() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role in ('manager','admin'));
$$;

-- =========================
-- RLS
-- =========================
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.announcements enable row level security;
alter table public.contacts enable row level security;
alter table public.site_settings enable row level security;
alter table public.promotions enable row level security;
alter table public.jobs enable row level security;
alter table public.applications enable row level security;
alter table public.partnership_requests enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.loyalty_events enable row level security;
alter table public.order_events enable row level security;

-- Nettoyage anciennes policies V1
DROP POLICY IF EXISTS "read own profile" ON public.profiles;
DROP POLICY IF EXISTS "customer update own profile" ON public.profiles;
DROP POLICY IF EXISTS "admin update profiles" ON public.profiles;
DROP POLICY IF EXISTS "public read products" ON public.products;
DROP POLICY IF EXISTS "admin products" ON public.products;
DROP POLICY IF EXISTS "public read announcements" ON public.announcements;
DROP POLICY IF EXISTS "admin announcements" ON public.announcements;
DROP POLICY IF EXISTS "public read contacts" ON public.contacts;
DROP POLICY IF EXISTS "admin contacts" ON public.contacts;
DROP POLICY IF EXISTS "customer create order" ON public.orders;
DROP POLICY IF EXISTS "customer read own orders" ON public.orders;
DROP POLICY IF EXISTS "staff update orders" ON public.orders;
DROP POLICY IF EXISTS "customer insert items" ON public.order_items;
DROP POLICY IF EXISTS "read order items" ON public.order_items;

-- Profils
DROP POLICY IF EXISTS "profiles select" ON public.profiles;
DROP POLICY IF EXISTS "profiles update own" ON public.profiles;
create policy "profiles select" on public.profiles for select using (id=auth.uid() or public.is_staff());
create policy "profiles update own" on public.profiles for update using (id=auth.uid()) with check (id=auth.uid());

-- Catalogue / contenu public
DROP POLICY IF EXISTS "products public select" ON public.products;
DROP POLICY IF EXISTS "products direction all" ON public.products;
DROP POLICY IF EXISTS "products manage" ON public.products;
create policy "products public select" on public.products for select using (active=true or public.is_direction());
create policy "products direction all" on public.products for all using (public.is_direction()) with check (public.is_direction());

DROP POLICY IF EXISTS "announcements public select" ON public.announcements;
DROP POLICY IF EXISTS "announcements direction all" ON public.announcements;
DROP POLICY IF EXISTS "announcements manage" ON public.announcements;
create policy "announcements public select" on public.announcements for select using (active=true or public.is_direction());
create policy "announcements direction all" on public.announcements for all using (public.is_direction()) with check (public.is_direction());

DROP POLICY IF EXISTS "contacts public select" ON public.contacts;
DROP POLICY IF EXISTS "contacts direction all" ON public.contacts;
DROP POLICY IF EXISTS "contacts manage" ON public.contacts;
create policy "contacts public select" on public.contacts for select using (active=true or public.is_direction());
create policy "contacts direction all" on public.contacts for all using (public.is_direction()) with check (public.is_direction());

DROP POLICY IF EXISTS "settings public select" ON public.site_settings;
DROP POLICY IF EXISTS "settings direction update" ON public.site_settings;
create policy "settings public select" on public.site_settings for select using (true);
create policy "settings direction update" on public.site_settings for update using (public.is_direction()) with check (public.is_direction());

DROP POLICY IF EXISTS "promotions public select" ON public.promotions;
DROP POLICY IF EXISTS "promotions direction all" ON public.promotions;
DROP POLICY IF EXISTS "promotions manage" ON public.promotions;
create policy "promotions public select" on public.promotions for select using (active=true or public.is_direction());
create policy "promotions direction all" on public.promotions for all using (public.is_direction()) with check (public.is_direction());

DROP POLICY IF EXISTS "jobs public select" ON public.jobs;
DROP POLICY IF EXISTS "jobs direction all" ON public.jobs;
DROP POLICY IF EXISTS "jobs manage" ON public.jobs;
create policy "jobs public select" on public.jobs for select using (active=true or public.is_direction());
create policy "jobs direction all" on public.jobs for all using (public.is_direction()) with check (public.is_direction());

DROP POLICY IF EXISTS "applications create" ON public.applications;
DROP POLICY IF EXISTS "applications direction select" ON public.applications;
DROP POLICY IF EXISTS "applications direction update" ON public.applications;
create policy "applications create" on public.applications for insert with check (true);
create policy "applications direction select" on public.applications for select using (public.is_direction());
create policy "applications direction update" on public.applications for update using (public.is_direction()) with check (public.is_direction());

DROP POLICY IF EXISTS "partnerships create" ON public.partnership_requests;
DROP POLICY IF EXISTS "partnerships direction select" ON public.partnership_requests;
DROP POLICY IF EXISTS "partnerships direction update" ON public.partnership_requests;
create policy "partnerships create" on public.partnership_requests for insert with check (true);
create policy "partnerships direction select" on public.partnership_requests for select using (public.is_direction());
create policy "partnerships direction update" on public.partnership_requests for update using (public.is_direction()) with check (public.is_direction());

-- Commandes : création / changements via fonctions sécurisées, lecture via RLS
DROP POLICY IF EXISTS "orders select" ON public.orders;
create policy "orders select" on public.orders for select using (user_id=auth.uid() or public.is_staff());
DROP POLICY IF EXISTS "order items select" ON public.order_items;
create policy "order items select" on public.order_items for select using (
  exists(select 1 from public.orders o where o.id=order_id and (o.user_id=auth.uid() or public.is_staff()))
);
DROP POLICY IF EXISTS "loyalty select" ON public.loyalty_events;
create policy "loyalty select" on public.loyalty_events for select using (user_id=auth.uid() or public.is_direction());
DROP POLICY IF EXISTS "order events select" ON public.order_events;
create policy "order events select" on public.order_events for select using (
  exists(select 1 from public.orders o where o.id=order_id and (o.user_id=auth.uid() or public.is_staff()))
);

-- Privilèges API explicites (les policies RLS restent la barrière d'accès).
grant select on public.products,public.announcements,public.contacts,public.site_settings,public.promotions,public.jobs to anon,authenticated;
grant insert on public.applications,public.partnership_requests to anon,authenticated;
grant select on public.profiles,public.orders,public.order_items,public.loyalty_events,public.order_events,public.applications,public.partnership_requests to authenticated;
grant insert,update,delete on public.products,public.announcements,public.contacts,public.promotions,public.jobs to authenticated;
grant update on public.site_settings,public.applications,public.partnership_requests to authenticated;

-- Le client peut uniquement modifier les champs non sensibles de son profil.
revoke update on public.profiles from authenticated;
grant update (display_name, phone, favorite_address) on public.profiles to authenticated;
-- Les écritures de commandes passent par les RPC ci-dessous.
revoke insert, update, delete on public.orders from authenticated;
revoke insert, update, delete on public.order_items from authenticated;
revoke insert, update, delete on public.loyalty_events from authenticated;
revoke insert, update, delete on public.order_events from authenticated;

-- =========================
-- CRÉATION DE COMMANDE SÉCURISÉE
-- =========================
create or replace function public.create_customer_order(
  p_items jsonb,
  p_fulfillment text,
  p_address text,
  p_phone text,
  p_note text default '',
  p_redeem_points boolean default false,
  p_promo_code text default null
) returns text
language plpgsql security definer set search_path=public as $$
declare
  s public.site_settings%rowtype;
  prof public.profiles%rowtype;
  item jsonb;
  prod public.products%rowtype;
  qty integer;
  v_subtotal numeric(12,2):=0;
  v_discount numeric(12,2):=0;
  v_fee numeric(12,2):=0;
  v_total numeric(12,2):=0;
  v_order_id uuid;
  v_code text;
  promo public.promotions%rowtype;
  v_has_promo boolean:=false;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select * into s from public.site_settings where id='main';
  if not s.business_open then raise exception 'Les commandes sont momentanément fermées'; end if;
  if p_fulfillment not in ('delivery','pickup') then raise exception 'Mode de commande invalide'; end if;
  if p_fulfillment='delivery' and not s.delivery_enabled then raise exception 'Livraison momentanément indisponible'; end if;
  if p_fulfillment='pickup' and not s.pickup_enabled then raise exception 'Retrait momentanément indisponible'; end if;
  if p_fulfillment='delivery' and coalesce(trim(p_address),'')='' then raise exception 'Lieu de livraison obligatoire'; end if;
  if coalesce(trim(p_phone),'')='' then raise exception 'Numéro de téléphone obligatoire'; end if;
  if p_items is null or jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Panier invalide'; end if;
  if jsonb_array_length(p_items)=0 then raise exception 'Panier vide'; end if;

  select * into prof from public.profiles where id=auth.uid() for update;
  if prof.id is null then raise exception 'Profil introuvable'; end if;

  -- Recalcule le panier depuis les vrais prix en base.
  for item in select * from jsonb_array_elements(p_items)
  loop
    qty := greatest(1, least(999, coalesce((item->>'quantity')::integer,1)));
    select * into prod from public.products where id=(item->>'product_id')::uuid and active=true and available=true for update;
    if prod.id is null then raise exception 'Un article est indisponible'; end if;
    if prod.stock is not null and prod.stock < qty then raise exception 'Stock insuffisant pour %', prod.name; end if;
    v_subtotal := v_subtotal + (prod.price * qty);
  end loop;
  if v_subtotal < s.min_order then raise exception 'Minimum de commande : % $', s.min_order; end if;

  -- Code promo saisi, sinon première offre automatique valide.
  if p_promo_code is not null and trim(p_promo_code)<>'' then
    select * into promo from public.promotions
      where active=true and auto_apply=false and upper(code)=upper(trim(p_promo_code))
      and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>=now()) limit 1;
  else
    select * into promo from public.promotions
      where active=true and auto_apply=true
      and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>=now())
      order by created_at desc limit 1;
  end if;
  v_has_promo := promo.id is not null and v_subtotal >= coalesce(promo.min_subtotal,0);
  if v_has_promo then
    if promo.discount_type='percent' then v_discount:=least(v_subtotal, round(v_subtotal*promo.value/100,2)); end if;
    if promo.discount_type='fixed' then v_discount:=least(v_subtotal,promo.value); end if;
  end if;

  if p_fulfillment='delivery' then v_fee:=s.delivery_fee; else v_fee:=0; end if;
  if v_has_promo and promo.discount_type='free_delivery' then v_fee:=0; end if;

  if p_redeem_points then
    if p_fulfillment<>'delivery' then raise exception 'La récompense fidélité concerne la livraison'; end if;
    if v_fee=0 then raise exception 'La livraison est déjà offerte'; end if;
    if prof.loyalty_points < s.loyalty_reward_points then raise exception 'Points fidélité insuffisants'; end if;
    update public.profiles set loyalty_points=loyalty_points-s.loyalty_reward_points where id=auth.uid();
    v_fee:=0;
  end if;

  v_total:=greatest(0,v_subtotal-v_discount)+v_fee;
  v_code:='SS-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));

  insert into public.orders(
    user_id,public_code,customer_name,customer_phone,fulfillment,delivery_address,note,
    subtotal,discount,delivery_fee,total,status,used_loyalty_reward,promotion_id,eta_min,eta_max
  ) values (
    auth.uid(),v_code,prof.display_name,p_phone,p_fulfillment,
    case when p_fulfillment='pickup' then s.address else p_address end,
    coalesce(p_note,''),v_subtotal,v_discount,v_fee,v_total,'pending',p_redeem_points,
    case when v_has_promo then promo.id else null end,s.delivery_eta_min,s.delivery_eta_max
  ) returning id into v_order_id;

  insert into public.order_events(order_id,status,actor_id,actor_name,note)
  values(v_order_id,'pending',auth.uid(),prof.display_name,'Commande créée');

  for item in select * from jsonb_array_elements(p_items)
  loop
    qty := greatest(1, least(999, coalesce((item->>'quantity')::integer,1)));
    select * into prod from public.products where id=(item->>'product_id')::uuid for update;
    insert into public.order_items(order_id,product_id,product_name,unit_price,quantity,line_total)
    values(v_order_id,prod.id,prod.name,prod.price,qty,prod.price*qty);
    if prod.stock is not null then update public.products set stock=stock-qty where id=prod.id; end if;
  end loop;

  if p_redeem_points then
    insert into public.loyalty_events(user_id,order_id,points,description)
    values(auth.uid(),v_order_id,-s.loyalty_reward_points,'Livraison offerte utilisée');
  end if;
  return v_code;
end; $$;

grant execute on function public.create_customer_order(jsonb,text,text,text,text,boolean,text) to authenticated;

-- =========================
-- OUTILS ÉQUIPE
-- =========================
create or replace function public.claim_order(p_order_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare n text;
begin
  if not public.is_staff() then raise exception 'Accès équipe requis'; end if;
  select display_name into n from public.profiles where id=auth.uid();
  update public.orders
    set assigned_to=auth.uid(), assigned_name=n, assigned_at=coalesce(assigned_at,now()), status=case when status='pending' then 'accepted' else status end
    where id=p_order_id and status not in ('delivered','cancelled') and (assigned_to is null or assigned_to=auth.uid());
  if not found then raise exception 'Cette commande est déjà prise ou terminée'; end if;
  insert into public.order_events(order_id,status,actor_id,actor_name,note)
  values(p_order_id,'accepted',auth.uid(),n,'Commande prise en charge');
end; $$;
grant execute on function public.claim_order(uuid) to authenticated;

create or replace function public.set_order_status(p_order_id uuid,p_status text,p_reason text default null) returns void
language plpgsql security definer set search_path=public as $$
declare o public.orders%rowtype; s public.site_settings%rowtype;
begin
  if not public.is_staff() then raise exception 'Accès équipe requis'; end if;
  if p_status not in ('accepted','preparing','ready','out_for_delivery','delivered','cancelled') then raise exception 'Statut invalide'; end if;
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null then raise exception 'Commande introuvable'; end if;
  if o.assigned_to is not null and o.assigned_to<>auth.uid() and not public.is_direction() then raise exception 'Cette commande est attribuée à un autre employé'; end if;
  if o.status in ('delivered','cancelled') then raise exception 'Commande déjà terminée'; end if;
  select * into s from public.site_settings where id='main';

  if p_status='cancelled' then
    if coalesce(trim(p_reason),'')='' then raise exception 'Motif d''annulation obligatoire'; end if;
    if o.used_loyalty_reward and not o.loyalty_refunded then
      update public.profiles set loyalty_points=loyalty_points+s.loyalty_reward_points where id=o.user_id;
      insert into public.loyalty_events(user_id,order_id,points,description) values(o.user_id,o.id,s.loyalty_reward_points,'Récompense remboursée après annulation');
      o.loyalty_refunded:=true;
    end if;
    if not o.stock_restocked then
      update public.products p set stock=p.stock+i.quantity
      from public.order_items i where i.order_id=o.id and i.product_id=p.id and p.stock is not null;
      o.stock_restocked:=true;
    end if;
  end if;

  if p_status='delivered' and not o.loyalty_awarded then
    update public.profiles set loyalty_points=loyalty_points+s.points_per_order where id=o.user_id;
    insert into public.loyalty_events(user_id,order_id,points,description) values(o.user_id,o.id,s.points_per_order,'Commande livrée');
    o.loyalty_awarded:=true;
  end if;

  update public.orders set
    status=p_status,
    cancelled_reason=case when p_status='cancelled' then p_reason else cancelled_reason end,
    loyalty_refunded=o.loyalty_refunded,
    stock_restocked=o.stock_restocked,
    loyalty_awarded=o.loyalty_awarded,
    delivered_at=case when p_status='delivered' then now() else delivered_at end
  where id=o.id;

  insert into public.order_events(order_id,status,actor_id,actor_name,note)
  select o.id,p_status,auth.uid(),display_name,coalesce(p_reason,'') from public.profiles where id=auth.uid();
end; $$;
grant execute on function public.set_order_status(uuid,text,text) to authenticated;

create or replace function public.admin_set_role(p_user_id uuid,p_role text) returns void
language plpgsql security definer set search_path=public as $$
declare caller_role text; target_role text;
begin
  if not public.is_direction() then raise exception 'Accès direction requis'; end if;
  if p_role not in ('customer','employee','manager','admin') then raise exception 'Rôle invalide'; end if;
  select role into caller_role from public.profiles where id=auth.uid();
  select role into target_role from public.profiles where id=p_user_id;
  if caller_role='manager' and (p_role='admin' or target_role='admin') then raise exception 'Seule la direction principale peut modifier ce rôle'; end if;
  update public.profiles set role=p_role where id=p_user_id;
end; $$;
grant execute on function public.admin_set_role(uuid,text) to authenticated;

create or replace function public.admin_adjust_loyalty(p_user_id uuid,p_delta integer,p_reason text) returns void
language plpgsql security definer set search_path=public as $$
declare current_points integer;
begin
  if not public.is_direction() then raise exception 'Accès direction requis'; end if;
  if p_delta=0 then raise exception 'Aucun ajustement'; end if;
  if coalesce(trim(p_reason),'')='' then raise exception 'Motif obligatoire'; end if;
  select loyalty_points into current_points from public.profiles where id=p_user_id for update;
  if current_points is null then raise exception 'Client introuvable'; end if;
  if current_points+p_delta<0 then raise exception 'Le solde ne peut pas devenir négatif'; end if;
  update public.profiles set loyalty_points=loyalty_points+p_delta where id=p_user_id;
  insert into public.loyalty_events(user_id,points,description) values(p_user_id,p_delta,p_reason);
end; $$;
grant execute on function public.admin_adjust_loyalty(uuid,integer,text) to authenticated;

-- =========================
-- DONNÉES DE DÉPART
-- =========================
insert into public.announcements(title,body,type,featured)
select 'Recrutement ouvert','Les recrutements du LTD ont lieu le dimanche. Venez rencontrer notre équipe et découvrir les postes disponibles.','recruitment',true
where not exists(select 1 from public.announcements where title='Recrutement ouvert');

insert into public.announcements(title,body,type,featured)
select 'Service de livraison','Commandez vos produits depuis votre téléphone et suivez chaque étape de votre commande.','news',false
where not exists(select 1 from public.announcements where title='Service de livraison');

insert into public.contacts(label,name,phone,sort_order)
select 'Patron','Blake Mars','À renseigner',1 where not exists(select 1 from public.contacts where label='Patron');
insert into public.contacts(label,name,phone,sort_order)
select 'Co-patronne','Luciana Angel Mars','À renseigner',2 where not exists(select 1 from public.contacts where label='Co-patronne');
insert into public.contacts(label,name,phone,sort_order)
select 'Accueil LTD','LTD Sandy Shores','À renseigner',3 where not exists(select 1 from public.contacts where label='Accueil LTD');

insert into public.jobs(title,description)
select 'Vendeur / Vendeuse','Accueil clients, ventes et tenue de la boutique.' where not exists(select 1 from public.jobs where title='Vendeur / Vendeuse');
insert into public.jobs(title,description)
select 'Pompiste','Gestion des stations, livraisons d’essence et suivi des stocks.' where not exists(select 1 from public.jobs where title='Pompiste');
insert into public.jobs(title,description)
select 'Livreur / Livreuse','Préparation et acheminement des commandes clients.' where not exists(select 1 from public.jobs where title='Livreur / Livreuse');

-- Active les mises à jour en direct des commandes si ce n'est pas déjà fait.
do $$ begin
  alter publication supabase_realtime add table public.orders;
exception when duplicate_object then null;
end $$;

-- APRÈS avoir créé ton premier compte depuis le site, rends-le Direction :
-- update public.profiles set role='admin' where id=(select id from auth.users where email='TON_EMAIL');

-- =========================================================
-- V5 — ÉQUIPE, RÔLES, PERMISSIONS, PACKS, PROFILS & RECRUTEMENT
-- =========================================================

-- Profils employés détaillés
alter table public.profiles add column if not exists staff_role text;
alter table public.profiles add column if not exists avatar_url text default '';
alter table public.profiles add column if not exists show_phone boolean not null default false;
alter table public.profiles add column if not exists profile_bio text default '';
alter table public.profiles drop constraint if exists profiles_staff_role_check;
alter table public.profiles add constraint profiles_staff_role_check check (
  staff_role is null or staff_role in (
    'patron','copatron',
    'vendeur_novice','vendeur_intermediaire','vendeur_experimente',
    'pompiste_novice','pompiste_intermediaire','pompiste_experimente',
    'chef_equipe','livreur','responsable_pompiste','responsable_vente'
  )
);

-- Packs
alter table public.products add column if not exists is_pack boolean not null default false;
alter table public.products add column if not exists is_pack_of_month boolean not null default false;

create table if not exists public.pack_items (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references public.products(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  unique(pack_id, product_id)
);

-- Permissions configurables par rôle
create table if not exists public.role_permissions (
  staff_role text not null,
  permission_key text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (staff_role, permission_key)
);

-- Codes d'accès employés : seul le hash du code est stocké.
create table if not exists public.staff_access_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  label text,
  staff_role text not null,
  max_uses integer not null default 1 check (max_uses > 0),
  uses integer not null default 0 check (uses >= 0),
  active boolean not null default true,
  expires_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Les deux codes initiaux Patron / Co-patron sont pré-hachés.
-- Le texte en clair n'est jamais publié dans le site ou dans la base.
insert into public.staff_access_codes(code_hash,label,staff_role,max_uses,active)
values
('ba0e6055992f327eb05a4104273d8fc23beaafc5e72c6b27232e88056e530b1e','Accès initial Patron','patron',1,true),
('7890a38f8f24fdd53d84ebba0434bb29a1b3a34f6d849665d53bcf8f9116b7b0','Accès initial Co-patron','copatron',1,true)
on conflict (code_hash) do nothing;

-- Helpers V5
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.profiles
    where id=auth.uid() and (staff_role is not null or role in ('employee','manager','admin'))
  );
$$;

create or replace function public.is_direction() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.profiles
    where id=auth.uid() and (staff_role in ('patron','copatron') or role in ('manager','admin'))
  );
$$;

create or replace function public.has_permission(p_permission text) returns boolean
language sql stable security definer set search_path=public as $$
  select public.is_direction() or exists(
    select 1
    from public.profiles p
    join public.role_permissions rp on rp.staff_role=p.staff_role
    where p.id=auth.uid() and rp.permission_key=p_permission and rp.enabled=true
  );
$$;

grant execute on function public.is_staff() to anon,authenticated;
grant execute on function public.is_direction() to anon,authenticated;
grant execute on function public.has_permission(text) to authenticated;

create or replace function public.get_my_permissions() returns setof text
language sql stable security definer set search_path=public as $$
  select rp.permission_key
  from public.profiles p
  join public.role_permissions rp on rp.staff_role=p.staff_role
  where p.id=auth.uid() and rp.enabled=true;
$$;
grant execute on function public.get_my_permissions() to authenticated;

-- Contacts publics des employés : le téléphone ne sort que si l'employé l'autorise.
create or replace function public.get_public_staff_contacts()
returns table(id uuid,name text,phone text,label text,avatar_url text,bio text,staff_role text)
language sql stable security definer set search_path=public as $$
  select p.id,
         coalesce(p.display_name,'Employé') as name,
         case when p.show_phone then coalesce(p.phone,'') else '' end as phone,
         case p.staff_role
           when 'patron' then 'Patron'
           when 'copatron' then 'Co-patron'
           when 'vendeur_novice' then 'Vendeur novice'
           when 'vendeur_intermediaire' then 'Vendeur intermédiaire'
           when 'vendeur_experimente' then 'Vendeur expérimenté'
           when 'pompiste_novice' then 'Pompiste novice'
           when 'pompiste_intermediaire' then 'Pompiste intermédiaire'
           when 'pompiste_experimente' then 'Pompiste expérimenté'
           when 'chef_equipe' then 'Chef d’équipe'
           when 'livreur' then 'Livreur'
           when 'responsable_pompiste' then 'Responsable pompiste'
           when 'responsable_vente' then 'Responsable vente'
           else 'Équipe LTD'
         end as label,
         coalesce(p.avatar_url,'') as avatar_url,
         coalesce(p.profile_bio,'') as bio,
         p.staff_role
  from public.profiles p
  where p.staff_role is not null
  order by case when p.staff_role='patron' then 0 when p.staff_role='copatron' then 1 else 2 end, p.display_name;
$$;
grant execute on function public.get_public_staff_contacts() to anon,authenticated;

-- Utiliser un code d'accès sur le compte actuellement connecté.
create or replace function public.redeem_staff_access_code(p_code text) returns text
language plpgsql security definer set search_path=public as $$
declare
  h text;
  c public.staff_access_codes%rowtype;
  new_role text;
begin
  if auth.uid() is null then raise exception 'Connectez-vous avant d’utiliser un code'; end if;
  if coalesce(trim(p_code),'')='' then raise exception 'Code d’accès obligatoire'; end if;
  h := encode(digest(upper(trim(p_code)),'sha256'),'hex');
  select * into c from public.staff_access_codes where code_hash=h for update;
  if c.id is null or not c.active then raise exception 'Code invalide ou désactivé'; end if;
  if c.expires_at is not null and c.expires_at < now() then raise exception 'Ce code a expiré'; end if;
  if c.uses >= c.max_uses then raise exception 'Ce code a déjà été utilisé'; end if;

  new_role := c.staff_role;
  update public.profiles
  set staff_role=new_role,
      role=case when new_role in ('patron','copatron') then 'admin' else 'employee' end
  where id=auth.uid();

  update public.staff_access_codes
  set uses=uses+1,
      active=case when uses+1>=max_uses then false else active end
  where id=c.id;
  return new_role;
end; $$;
grant execute on function public.redeem_staff_access_code(text) to authenticated;

-- Générer un code d'accès côté serveur. Le code en clair n'est renvoyé qu'une seule fois.
create or replace function public.create_staff_access_code(
  p_staff_role text,
  p_max_uses integer default 1,
  p_label text default null
) returns table(code text)
language plpgsql security definer set search_path=public as $$
declare
  plain text;
  h text;
begin
  if not public.is_direction() then raise exception 'Accès Patron / Co-patron requis'; end if;
  if p_staff_role not in (
    'patron','copatron','vendeur_novice','vendeur_intermediaire','vendeur_experimente',
    'pompiste_novice','pompiste_intermediaire','pompiste_experimente','chef_equipe','livreur','responsable_pompiste','responsable_vente'
  ) then raise exception 'Rôle invalide'; end if;
  p_max_uses := greatest(1,least(coalesce(p_max_uses,1),20));
  plain := 'LTD-' || upper(substr(encode(gen_random_bytes(6),'hex'),1,4)) || '-' || upper(substr(encode(gen_random_bytes(6),'hex'),1,4)) || '-' || upper(substr(encode(gen_random_bytes(6),'hex'),1,4));
  h := encode(digest(upper(plain),'sha256'),'hex');
  insert into public.staff_access_codes(code_hash,label,staff_role,max_uses,created_by)
  values(h,p_label,p_staff_role,p_max_uses,auth.uid());
  return query select plain;
end; $$;
grant execute on function public.create_staff_access_code(text,integer,text) to authenticated;

create or replace function public.admin_set_staff_role(p_user_id uuid,p_staff_role text) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_direction() then raise exception 'Accès Patron / Co-patron requis'; end if;
  if p_staff_role is not null and p_staff_role not in (
    'patron','copatron','vendeur_novice','vendeur_intermediaire','vendeur_experimente',
    'pompiste_novice','pompiste_intermediaire','pompiste_experimente','chef_equipe','livreur','responsable_pompiste','responsable_vente'
  ) then raise exception 'Rôle invalide'; end if;
  update public.profiles
  set staff_role=p_staff_role,
      role=case when p_staff_role is null then 'customer' when p_staff_role in ('patron','copatron') then 'admin' else 'employee' end
  where id=p_user_id;
end; $$;
grant execute on function public.admin_set_staff_role(uuid,text) to authenticated;

create or replace function public.admin_set_role_permissions(p_staff_role text,p_permissions text[]) returns void
language plpgsql security definer set search_path=public as $$
declare p text;
begin
  if not public.is_direction() then raise exception 'Accès Patron / Co-patron requis'; end if;
  if p_staff_role in ('patron','copatron') then raise exception 'Patron et Co-patron possèdent toujours tous les accès'; end if;
  delete from public.role_permissions where staff_role=p_staff_role;
  foreach p in array coalesce(p_permissions,array[]::text[]) loop
    insert into public.role_permissions(staff_role,permission_key,enabled) values(p_staff_role,p,true)
    on conflict (staff_role,permission_key) do update set enabled=true,updated_at=now();
  end loop;
end; $$;
grant execute on function public.admin_set_role_permissions(text,text[]) to authenticated;

-- Permissions par défaut : elles peuvent ensuite être modifiées dans le site.
insert into public.role_permissions(staff_role,permission_key,enabled) values
('vendeur_novice','orders_view',true),('vendeur_novice','orders_claim',true),
('vendeur_intermediaire','orders_view',true),('vendeur_intermediaire','orders_claim',true),('vendeur_intermediaire','orders_manage',true),
('vendeur_experimente','orders_view',true),('vendeur_experimente','orders_claim',true),('vendeur_experimente','orders_manage',true),
('livreur','orders_view',true),('livreur','orders_claim',true),('livreur','orders_manage',true),
('chef_equipe','orders_view',true),('chef_equipe','orders_claim',true),('chef_equipe','orders_manage',true),('chef_equipe','stats_view',true),
('responsable_pompiste','orders_view',true),('responsable_pompiste','team_manage',true),
('responsable_vente','orders_view',true),('responsable_vente','orders_claim',true),('responsable_vente','orders_manage',true),
('responsable_vente','catalog_manage',true),('responsable_vente','packs_manage',true),('responsable_vente','announcements_manage',true),
('responsable_vente','recruitment_manage',true),('responsable_vente','stats_view',true)
on conflict (staff_role,permission_key) do nothing;

-- RLS des nouvelles tables
alter table public.pack_items enable row level security;
alter table public.role_permissions enable row level security;
alter table public.staff_access_codes enable row level security;

DROP POLICY IF EXISTS "pack items public select" ON public.pack_items;
DROP POLICY IF EXISTS "pack items manage" ON public.pack_items;
create policy "pack items public select" on public.pack_items for select using (
  exists(select 1 from public.products p where p.id=pack_id and (p.active=true or public.has_permission('packs_manage')))
);
create policy "pack items manage" on public.pack_items for all using (public.has_permission('packs_manage')) with check (public.has_permission('packs_manage'));

grant select on public.pack_items to anon,authenticated;
grant insert,update,delete on public.pack_items to authenticated;

grant select on public.role_permissions to authenticated;
DROP POLICY IF EXISTS "role permissions direction read" ON public.role_permissions;
create policy "role permissions direction read" on public.role_permissions for select using (public.is_direction());

-- Aucun accès direct aux hashes des codes depuis le navigateur.
revoke all on public.staff_access_codes from anon,authenticated;

-- Remplacement des policies V2 par les permissions V5.
DROP POLICY IF EXISTS "profiles select" ON public.profiles;
DROP POLICY IF EXISTS "profiles update own" ON public.profiles;
create policy "profiles select" on public.profiles for select using (
  id=auth.uid() or public.has_permission('team_manage') or public.has_permission('customers_manage')
);
create policy "profiles update own" on public.profiles for update using (id=auth.uid()) with check (id=auth.uid());

DROP POLICY IF EXISTS "products public select" ON public.products;
DROP POLICY IF EXISTS "products direction all" ON public.products;
DROP POLICY IF EXISTS "products manage" ON public.products;
create policy "products public select" on public.products for select using (
  active=true or public.has_permission('catalog_manage') or public.has_permission('packs_manage')
);
create policy "products manage" on public.products for all using (
  public.has_permission('catalog_manage') or public.has_permission('packs_manage')
) with check (
  public.has_permission('catalog_manage') or public.has_permission('packs_manage')
);

DROP POLICY IF EXISTS "announcements public select" ON public.announcements;
DROP POLICY IF EXISTS "announcements direction all" ON public.announcements;
DROP POLICY IF EXISTS "announcements manage" ON public.announcements;
create policy "announcements public select" on public.announcements for select using (active=true or public.has_permission('announcements_manage'));
create policy "announcements manage" on public.announcements for all using (public.has_permission('announcements_manage')) with check (public.has_permission('announcements_manage'));

DROP POLICY IF EXISTS "contacts public select" ON public.contacts;
DROP POLICY IF EXISTS "contacts direction all" ON public.contacts;
DROP POLICY IF EXISTS "contacts manage" ON public.contacts;
create policy "contacts public select" on public.contacts for select using (active=true or public.has_permission('contacts_manage'));
create policy "contacts manage" on public.contacts for all using (public.has_permission('contacts_manage')) with check (public.has_permission('contacts_manage'));

DROP POLICY IF EXISTS "settings direction update" ON public.site_settings;
DROP POLICY IF EXISTS "settings manage" ON public.site_settings;
create policy "settings manage" on public.site_settings for update using (public.has_permission('settings_manage')) with check (public.has_permission('settings_manage'));

DROP POLICY IF EXISTS "promotions public select" ON public.promotions;
DROP POLICY IF EXISTS "promotions direction all" ON public.promotions;
DROP POLICY IF EXISTS "promotions manage" ON public.promotions;
create policy "promotions public select" on public.promotions for select using (active=true or public.has_permission('promotions_manage'));
create policy "promotions manage" on public.promotions for all using (public.has_permission('promotions_manage')) with check (public.has_permission('promotions_manage'));

DROP POLICY IF EXISTS "jobs public select" ON public.jobs;
DROP POLICY IF EXISTS "jobs direction all" ON public.jobs;
DROP POLICY IF EXISTS "jobs manage" ON public.jobs;
create policy "jobs public select" on public.jobs for select using (true);
create policy "jobs manage" on public.jobs for all using (public.has_permission('recruitment_manage')) with check (public.has_permission('recruitment_manage'));

-- Plus aucune candidature publique depuis le site.
DROP POLICY IF EXISTS "applications create" ON public.applications;
DROP POLICY IF EXISTS "applications direction select" ON public.applications;
DROP POLICY IF EXISTS "applications direction update" ON public.applications;
revoke insert on public.applications from anon,authenticated;

DROP POLICY IF EXISTS "partnerships direction select" ON public.partnership_requests;
DROP POLICY IF EXISTS "partnerships direction update" ON public.partnership_requests;
DROP POLICY IF EXISTS "partnerships manage select" ON public.partnership_requests;
DROP POLICY IF EXISTS "partnerships manage update" ON public.partnership_requests;
create policy "partnerships manage select" on public.partnership_requests for select using (public.has_permission('partnerships_manage'));
create policy "partnerships manage update" on public.partnership_requests for update using (public.has_permission('partnerships_manage')) with check (public.has_permission('partnerships_manage'));

DROP POLICY IF EXISTS "orders select" ON public.orders;
create policy "orders select" on public.orders for select using (user_id=auth.uid() or public.has_permission('orders_view'));
DROP POLICY IF EXISTS "order items select" ON public.order_items;
create policy "order items select" on public.order_items for select using (
  exists(select 1 from public.orders o where o.id=order_id and (o.user_id=auth.uid() or public.has_permission('orders_view')))
);
DROP POLICY IF EXISTS "order events select" ON public.order_events;
create policy "order events select" on public.order_events for select using (
  exists(select 1 from public.orders o where o.id=order_id and (o.user_id=auth.uid() or public.has_permission('orders_view')))
);
DROP POLICY IF EXISTS "loyalty select" ON public.loyalty_events;
create policy "loyalty select" on public.loyalty_events for select using (user_id=auth.uid() or public.has_permission('customers_manage'));

-- Colonnes de profil qu'un utilisateur peut modifier lui-même.
revoke update on public.profiles from authenticated;
grant update (display_name,phone,favorite_address,avatar_url,show_phone,profile_bio) on public.profiles to authenticated;

-- RPC commandes avec permissions V5
create or replace function public.claim_order(p_order_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare n text;
begin
  if not public.has_permission('orders_claim') then raise exception 'Vous n’avez pas l’accès pour prendre une commande'; end if;
  select display_name into n from public.profiles where id=auth.uid();
  update public.orders
    set assigned_to=auth.uid(),assigned_name=n,assigned_at=coalesce(assigned_at,now()),status=case when status='pending' then 'accepted' else status end
    where id=p_order_id and status not in ('delivered','cancelled') and (assigned_to is null or assigned_to=auth.uid());
  if not found then raise exception 'Cette commande est déjà prise ou terminée'; end if;
  insert into public.order_events(order_id,status,actor_id,actor_name,note)
  values(p_order_id,'accepted',auth.uid(),n,'Commande prise en charge');
end; $$;
grant execute on function public.claim_order(uuid) to authenticated;

create or replace function public.set_order_status(p_order_id uuid,p_status text,p_reason text default null) returns void
language plpgsql security definer set search_path=public as $$
declare o public.orders%rowtype; s public.site_settings%rowtype;
begin
  if not public.has_permission('orders_manage') then raise exception 'Vous n’avez pas l’accès pour gérer une commande'; end if;
  if p_status not in ('accepted','preparing','ready','out_for_delivery','delivered','cancelled') then raise exception 'Statut invalide'; end if;
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null then raise exception 'Commande introuvable'; end if;
  if o.assigned_to is not null and o.assigned_to<>auth.uid() and not public.is_direction() then raise exception 'Cette commande est attribuée à un autre employé'; end if;
  if o.status in ('delivered','cancelled') then raise exception 'Commande déjà terminée'; end if;
  select * into s from public.site_settings where id='main';
  if p_status='cancelled' then
    if coalesce(trim(p_reason),'')='' then raise exception 'Motif d''annulation obligatoire'; end if;
    if o.used_loyalty_reward and not o.loyalty_refunded then
      update public.profiles set loyalty_points=loyalty_points+s.loyalty_reward_points where id=o.user_id;
      insert into public.loyalty_events(user_id,order_id,points,description) values(o.user_id,o.id,s.loyalty_reward_points,'Récompense remboursée après annulation');
      o.loyalty_refunded:=true;
    end if;
    if not o.stock_restocked then
      update public.products p set stock=p.stock+i.quantity from public.order_items i
      where i.order_id=o.id and i.product_id=p.id and p.stock is not null;
      o.stock_restocked:=true;
    end if;
  end if;
  if p_status='delivered' and not o.loyalty_awarded then
    update public.profiles set loyalty_points=loyalty_points+s.points_per_order where id=o.user_id;
    insert into public.loyalty_events(user_id,order_id,points,description) values(o.user_id,o.id,s.points_per_order,'Commande livrée');
    o.loyalty_awarded:=true;
  end if;
  update public.orders set status=p_status,cancelled_reason=case when p_status='cancelled' then p_reason else cancelled_reason end,
    loyalty_refunded=o.loyalty_refunded,stock_restocked=o.stock_restocked,loyalty_awarded=o.loyalty_awarded,
    delivered_at=case when p_status='delivered' then now() else delivered_at end where id=o.id;
  insert into public.order_events(order_id,status,actor_id,actor_name,note)
  select o.id,p_status,auth.uid(),display_name,coalesce(p_reason,'') from public.profiles where id=auth.uid();
end; $$;
grant execute on function public.set_order_status(uuid,text,text) to authenticated;

create or replace function public.admin_adjust_loyalty(p_user_id uuid,p_delta integer,p_reason text) returns void
language plpgsql security definer set search_path=public as $$
declare current_points integer;
begin
  if not public.has_permission('customers_manage') then raise exception 'Accès clients requis'; end if;
  if p_delta=0 then raise exception 'Aucun ajustement'; end if;
  if coalesce(trim(p_reason),'')='' then raise exception 'Motif obligatoire'; end if;
  select loyalty_points into current_points from public.profiles where id=p_user_id for update;
  if current_points is null then raise exception 'Client introuvable'; end if;
  if current_points+p_delta<0 then raise exception 'Le solde ne peut pas devenir négatif'; end if;
  update public.profiles set loyalty_points=loyalty_points+p_delta where id=p_user_id;
  insert into public.loyalty_events(user_id,points,description) values(p_user_id,p_delta,p_reason);
end; $$;
grant execute on function public.admin_adjust_loyalty(uuid,integer,text) to authenticated;

-- Stockage des photos de profil
insert into storage.buckets(id,name,public) values('staff-avatars','staff-avatars',true)
on conflict (id) do update set public=true;

DROP POLICY IF EXISTS "staff avatars public read" ON storage.objects;
DROP POLICY IF EXISTS "staff avatars own insert" ON storage.objects;
DROP POLICY IF EXISTS "staff avatars own update" ON storage.objects;
DROP POLICY IF EXISTS "staff avatars own delete" ON storage.objects;
create policy "staff avatars public read" on storage.objects for select using (bucket_id='staff-avatars');
create policy "staff avatars own insert" on storage.objects for insert to authenticated with check (
  bucket_id='staff-avatars' and (storage.foldername(name))[1]=auth.uid()::text
);
create policy "staff avatars own update" on storage.objects for update to authenticated using (
  bucket_id='staff-avatars' and (storage.foldername(name))[1]=auth.uid()::text
) with check (
  bucket_id='staff-avatars' and (storage.foldername(name))[1]=auth.uid()::text
);
create policy "staff avatars own delete" on storage.objects for delete to authenticated using (
  bucket_id='staff-avatars' and (storage.foldername(name))[1]=auth.uid()::text
);

-- Recrutement : les trois postes sont toujours visibles, active=true signifie « recrute ».
insert into public.jobs(title,description,active)
select 'Vendeur / Vendeuse','Accueil clients, ventes et tenue de la boutique.',true
where not exists(select 1 from public.jobs where title='Vendeur / Vendeuse');
insert into public.jobs(title,description,active)
select 'Pompiste','Gestion des stations, livraisons d’essence et suivi des stocks.',true
where not exists(select 1 from public.jobs where title='Pompiste');
insert into public.jobs(title,description,active)
select 'Livreur / Livreuse','Préparation et acheminement des commandes clients.',true
where not exists(select 1 from public.jobs where title='Livreur / Livreuse');

-- ==========================================================
-- V6 — COMPTES NOMINATIFS, MOTS DE PASSE TEMPORAIRES & DIRECTION
-- ==========================================================

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists staff_username text;
alter table public.profiles add column if not exists must_change_password boolean not null default false;
create unique index if not exists profiles_staff_username_unique on public.profiles (lower(staff_username)) where staff_username is not null;

-- Conserve l'email des clients dans le profil afin que la direction puisse leur
-- envoyer un lien de réinitialisation sans accéder à leur mot de passe.
update public.profiles p set email=u.email
from auth.users u where u.id=p.id and (p.email is null or p.email='');

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles (id, display_name, phone, email, staff_username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'phone',''),
    new.email,
    nullif(new.raw_user_meta_data->>'staff_username','')
  )
  on conflict (id) do update set
    email=excluded.email,
    staff_username=coalesce(public.profiles.staff_username,excluded.staff_username);
  return new;
end; $$;

-- Les anciens codes d'accès ne servent plus à créer les comptes employés.
update public.staff_access_codes set active=false where active=true;

-- Retire les anciens accès génériques de direction. Les profils nominatifs
-- luciana.angelmars et blake.mars, une fois créés, restent bien direction.
update public.profiles
set staff_role=null, role='customer'
where staff_role in ('patron','copatron')
  and coalesce(lower(staff_username),'') not in ('luciana.angelmars','blake.mars');

-- Terminologie publique demandée.
update public.contacts set label='Gérant', name='Blake Mars' where lower(label) in ('patron','gérant') or lower(name)='blake mars';
update public.contacts set label='Cogérante', name='Luciana Angel Mars' where lower(label) in ('co-patronne','co-patron','copatronne','cogérante') or lower(name)='luciana angel mars';

-- Bootstrap sécurisé des deux comptes direction. Les mots de passe temporaires
-- ne sont jamais stockés en clair : uniquement sel + SHA-256.
create table if not exists public.direction_bootstrap (
  username text primary key,
  display_name text not null,
  staff_role text not null check (staff_role in ('patron','copatron')),
  salt text not null,
  password_hash text not null,
  used boolean not null default false,
  used_at timestamptz
);
alter table public.direction_bootstrap enable row level security;
revoke all on public.direction_bootstrap from anon,authenticated;

insert into public.direction_bootstrap(username,display_name,staff_role,salt,password_hash,used)
values
  ('luciana.angelmars','Luciana Angel Mars','copatron','cbdce8d386d469bbc278b0067de3828f','4f8d3539549396d8dbbdb6ba51a54f5c4971c560c67d361c15b8c721eb5544c7',false),
  ('blake.mars','Blake Mars','patron','f4cbc4aa0f6b23e330817ad2a3d6e488','f4eb033cf42e8a70c052ec64bbc135c464f1b973993258c81688f2cd74f7f82a',false)
on conflict (username) do update set
  display_name=excluded.display_name,
  staff_role=excluded.staff_role,
  salt=excluded.salt,
  password_hash=excluded.password_hash;

-- Si le script est rejoué après activation, ne réactive jamais les identifiants temporaires.
update public.direction_bootstrap b set used=true,used_at=coalesce(used_at,now())
where exists(select 1 from public.profiles p where lower(p.staff_username)=lower(b.username) and p.staff_role=b.staff_role);

create or replace function public.mark_password_changed() returns void
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  update public.profiles set must_change_password=false where id=auth.uid();
end; $$;
grant execute on function public.mark_password_changed() to authenticated;

-- Contacts publics des employés avec les nouveaux libellés direction.
create or replace function public.get_public_staff_contacts()
returns table(id uuid,name text,phone text,label text,avatar_url text,bio text,staff_role text)
language sql stable security definer set search_path=public as $$
  select p.id,
         p.display_name,
         p.phone,
         case p.staff_role
           when 'patron' then 'Gérant'
           when 'copatron' then 'Cogérante'
           when 'responsable_vente' then 'Responsable vente'
           when 'responsable_pompiste' then 'Responsable pompiste'
           when 'chef_equipe' then 'Chef d’équipe'
           when 'livreur' then 'Livreur'
           when 'vendeur_experimente' then 'Vendeur expérimenté'
           when 'vendeur_intermediaire' then 'Vendeur intermédiaire'
           when 'vendeur_novice' then 'Vendeur novice'
           when 'pompiste_experimente' then 'Pompiste expérimenté'
           when 'pompiste_intermediaire' then 'Pompiste intermédiaire'
           when 'pompiste_novice' then 'Pompiste novice'
           else 'Équipe LTD'
         end,
         coalesce(p.avatar_url,''),
         coalesce(p.profile_bio,''),
         p.staff_role
  from public.profiles p
  where p.staff_role is not null and p.show_phone=true
  order by case when p.staff_role='patron' then 0 when p.staff_role='copatron' then 1 else 2 end, p.display_name;
$$;
grant execute on function public.get_public_staff_contacts() to anon,authenticated;

-- ==========================================================
-- V7 — SYNCHRONISATION TEMPS RÉEL, ACCUEIL EMPLOYÉS & ANNUAIRE
-- ==========================================================

-- Tous les rôles employés peuvent par défaut ouvrir / fermer le LTD.
-- La direction peut ensuite décocher cette permission depuis le site.
insert into public.role_permissions(staff_role,permission_key,enabled) values
('vendeur_novice','business_status_manage',true),
('vendeur_intermediaire','business_status_manage',true),
('vendeur_experimente','business_status_manage',true),
('pompiste_novice','business_status_manage',true),
('pompiste_intermediaire','business_status_manage',true),
('pompiste_experimente','business_status_manage',true),
('chef_equipe','business_status_manage',true),
('livreur','business_status_manage',true),
('responsable_pompiste','business_status_manage',true),
('responsable_vente','business_status_manage',true)
on conflict (staff_role,permission_key) do nothing;

create or replace function public.set_business_status(p_open boolean) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not public.has_permission('business_status_manage') then
    raise exception 'Vous n’avez pas l’autorisation de modifier le statut du LTD';
  end if;
  update public.site_settings set business_open=p_open,updated_at=now() where id='main';
end; $$;
grant execute on function public.set_business_status(boolean) to authenticated;

-- Annuaire public : tous les employés sont affichés, mais le numéro reste privé
-- tant que l'employé n'a pas coché l'autorisation dans son profil.
create or replace function public.get_public_staff_roster()
returns table(id uuid,name text,phone text,label text,avatar_url text,bio text,staff_role text,rank_order integer)
language sql stable security definer set search_path=public as $$
  select p.id,
         coalesce(p.display_name,'Employé') as name,
         case when p.show_phone then coalesce(p.phone,'') else '' end as phone,
         case p.staff_role
           when 'patron' then 'Gérant'
           when 'copatron' then 'Cogérante'
           when 'responsable_vente' then 'Responsable vente'
           when 'responsable_pompiste' then 'Responsable pompiste'
           when 'chef_equipe' then 'Chef d’équipe'
           when 'vendeur_experimente' then 'Vendeur expérimenté'
           when 'pompiste_experimente' then 'Pompiste expérimenté'
           when 'vendeur_intermediaire' then 'Vendeur intermédiaire'
           when 'pompiste_intermediaire' then 'Pompiste intermédiaire'
           when 'vendeur_novice' then 'Vendeur novice'
           when 'pompiste_novice' then 'Pompiste novice'
           when 'livreur' then 'Livreur'
           else 'Employé'
         end as label,
         coalesce(p.avatar_url,'') as avatar_url,
         coalesce(p.profile_bio,'') as bio,
         p.staff_role,
         case p.staff_role
           when 'patron' then 10
           when 'copatron' then 20
           when 'responsable_vente' then 30
           when 'responsable_pompiste' then 40
           when 'chef_equipe' then 50
           when 'vendeur_experimente' then 60
           when 'pompiste_experimente' then 70
           when 'vendeur_intermediaire' then 80
           when 'pompiste_intermediaire' then 90
           when 'vendeur_novice' then 100
           when 'pompiste_novice' then 110
           when 'livreur' then 120
           else 999
         end as rank_order
  from public.profiles p
  where p.staff_role is not null
  order by rank_order,p.display_name;
$$;
grant execute on function public.get_public_staff_roster() to anon,authenticated;

-- Active le temps réel sur les tables affichées par plusieurs téléphones/PC.
do $$
declare t text;
begin
  foreach t in array array['orders','site_settings','products','announcements','contacts','jobs','profiles','promotions','partnership_requests'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename=t
    ) then
      execute format('alter publication supabase_realtime add table public.%I',t);
    end if;
  end loop;
end $$;
