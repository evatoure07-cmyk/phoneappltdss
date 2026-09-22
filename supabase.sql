-- LTD Sandy Shores — Base Supabase V2
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
create policy "products public select" on public.products for select using (active=true or public.is_direction());
create policy "products direction all" on public.products for all using (public.is_direction()) with check (public.is_direction());

DROP POLICY IF EXISTS "announcements public select" ON public.announcements;
DROP POLICY IF EXISTS "announcements direction all" ON public.announcements;
create policy "announcements public select" on public.announcements for select using (active=true or public.is_direction());
create policy "announcements direction all" on public.announcements for all using (public.is_direction()) with check (public.is_direction());

DROP POLICY IF EXISTS "contacts public select" ON public.contacts;
DROP POLICY IF EXISTS "contacts direction all" ON public.contacts;
create policy "contacts public select" on public.contacts for select using (active=true or public.is_direction());
create policy "contacts direction all" on public.contacts for all using (public.is_direction()) with check (public.is_direction());

DROP POLICY IF EXISTS "settings public select" ON public.site_settings;
DROP POLICY IF EXISTS "settings direction update" ON public.site_settings;
create policy "settings public select" on public.site_settings for select using (true);
create policy "settings direction update" on public.site_settings for update using (public.is_direction()) with check (public.is_direction());

DROP POLICY IF EXISTS "promotions public select" ON public.promotions;
DROP POLICY IF EXISTS "promotions direction all" ON public.promotions;
create policy "promotions public select" on public.promotions for select using (active=true or public.is_direction());
create policy "promotions direction all" on public.promotions for all using (public.is_direction()) with check (public.is_direction());

DROP POLICY IF EXISTS "jobs public select" ON public.jobs;
DROP POLICY IF EXISTS "jobs direction all" ON public.jobs;
create policy "jobs public select" on public.jobs for select using (active=true or public.is_direction());
create policy "jobs direction all" on public.jobs for all using (public.is_direction()) with check (public.is_direction());

DROP POLICY IF EXISTS "applications create" ON public.applications;
DROP POLICY IF EXISTS "applications direction select" ON public.applications;
DROP POLICY IF EXISTS "applications direction update" ON public.applications;
create policy "applications create" on public.applications for insert with check (true);
create policy "applications direction select" on public.applications for select using (public.is_direction());
create policy "applications direction update" on public.applications for update using (public.is_direction()) with check (public.is_direction());

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
grant insert on public.applications to anon,authenticated;
grant select on public.profiles,public.orders,public.order_items,public.loyalty_events,public.order_events,public.applications to authenticated;
grant insert,update,delete on public.products,public.announcements,public.contacts,public.promotions,public.jobs to authenticated;
grant update on public.site_settings,public.applications to authenticated;

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
