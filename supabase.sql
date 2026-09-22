-- LTD Sandy Shores — schéma Supabase
-- À coller dans Supabase > SQL Editor > New query > Run.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'customer' check (role in ('customer','employee','admin')),
  loyalty_points integer not null default 0 check (loyalty_points >= 0),
  created_at timestamptz not null default now()
);

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

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  type text not null default 'news' check (type in ('news','recruitment','alert')),
  featured boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  name text not null,
  phone text not null,
  sort_order integer not null default 0,
  active boolean not null default true
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
  status text not null default 'pending' check (status in ('pending','accepted','preparing','out_for_delivery','delivered','cancelled')),
  used_loyalty_reward boolean not null default false,
  loyalty_awarded boolean not null default false,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price numeric(12,2) not null,
  quantity integer not null check (quantity > 0),
  line_total numeric(12,2) not null
);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.announcements enable row level security;
alter table public.contacts enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create or replace function public.is_staff() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role in ('employee','admin'));
$$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='admin');
$$;

-- Profils
create policy "read own profile" on public.profiles for select using (id=auth.uid() or public.is_admin());
create policy "customer update own profile" on public.profiles for update using (id=auth.uid()) with check (id=auth.uid());
create policy "admin update profiles" on public.profiles for update using (public.is_admin()) with check (public.is_admin());

-- Catalogue/public
create policy "public read products" on public.products for select using (active=true or public.is_admin());
create policy "admin products" on public.products for all using (public.is_admin()) with check (public.is_admin());
create policy "public read announcements" on public.announcements for select using (active=true or public.is_admin());
create policy "admin announcements" on public.announcements for all using (public.is_admin()) with check (public.is_admin());
create policy "public read contacts" on public.contacts for select using (active=true or public.is_admin());
create policy "admin contacts" on public.contacts for all using (public.is_admin()) with check (public.is_admin());

-- Commandes
create policy "customer create order" on public.orders for insert with check (user_id=auth.uid());
create policy "customer read own orders" on public.orders for select using (user_id=auth.uid() or public.is_staff());
create policy "staff update orders" on public.orders for update using (public.is_staff()) with check (public.is_staff());
create policy "customer insert items" on public.order_items for insert with check (exists(select 1 from public.orders o where o.id=order_id and o.user_id=auth.uid()));
create policy "read order items" on public.order_items for select using (exists(select 1 from public.orders o where o.id=order_id and (o.user_id=auth.uid() or public.is_staff())));

-- Données de départ
insert into public.announcements(title,body,type,featured) values
('Recrutement ouvert','Les recrutements du LTD ont lieu le dimanche. Présentez-vous motivé(e) et disponible.','recruitment',true),
('Nouveau service de livraison','Commandez depuis votre téléphone RP et suivez votre commande jusqu’à la livraison.','news',false)
on conflict do nothing;

insert into public.contacts(label,name,phone,sort_order) values
('Patron','Blake Mars','À renseigner',1),
('Co-patronne','Luciana Angel Mars','À renseigner',2),
('LTD Sandy Shores','Accueil','À renseigner',3)
on conflict do nothing;

-- Après avoir créé TON compte depuis le site, rends-le admin avec cette requête :
-- update public.profiles set role='admin' where id=(select id from auth.users where email='TON_EMAIL');

-- Sécurisation fidélité + calcul automatique des totaux
-- Le client ne peut pas modifier directement ses points ni son rôle.
drop policy if exists "customer update own profile" on public.profiles;

create or replace function public.prepare_order() returns trigger
language plpgsql security definer set search_path=public as $$
declare pts integer;
begin
  if new.user_id <> auth.uid() then
    raise exception 'Commande non autorisée';
  end if;

  if new.used_loyalty_reward then
    select loyalty_points into pts from public.profiles where id=new.user_id for update;
    if coalesce(pts,0) < 100 then
      raise exception 'Points fidélité insuffisants';
    end if;
    update public.profiles set loyalty_points=loyalty_points-100 where id=new.user_id;
    new.delivery_fee := 0;
  else
    new.delivery_fee := 100;
  end if;
  new.total := coalesce(new.subtotal,0) + new.delivery_fee;
  return new;
end; $$;

drop trigger if exists trg_prepare_order on public.orders;
create trigger trg_prepare_order before insert on public.orders
for each row execute procedure public.prepare_order();

create or replace function public.recalculate_order_total() returns trigger
language plpgsql security definer set search_path=public as $$
declare oid uuid; s numeric(12,2);
begin
  oid := coalesce(new.order_id, old.order_id);
  select coalesce(sum(line_total),0) into s from public.order_items where order_id=oid;
  update public.orders set subtotal=s, total=s+delivery_fee where id=oid;
  return coalesce(new,old);
end; $$;

drop trigger if exists trg_recalculate_order_total on public.order_items;
create trigger trg_recalculate_order_total after insert or update or delete on public.order_items
for each row execute procedure public.recalculate_order_total();

create or replace function public.award_loyalty_on_delivery() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.status='delivered' and old.status is distinct from 'delivered' and old.loyalty_awarded=false then
    update public.profiles set loyalty_points=loyalty_points+10 where id=new.user_id;
    new.loyalty_awarded := true;
    new.delivered_at := coalesce(new.delivered_at, now());
  end if;
  return new;
end; $$;

drop trigger if exists trg_award_loyalty on public.orders;
create trigger trg_award_loyalty before update on public.orders
for each row execute procedure public.award_loyalty_on_delivery();
