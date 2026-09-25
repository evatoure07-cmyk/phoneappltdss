-- ==========================================================
-- V8 — APERÇU DES RÔLES & FIABILITÉ DES COMPTES
-- ==========================================================

-- Permet uniquement au Gérant, à la Cogérante et aux deux responsables
-- de consulter les permissions d'un rôle afin de prévisualiser son interface.
-- Cette fonction ne donne aucun droit supplémentaire et ne change jamais le rôle réel.
create or replace function public.get_preview_role_permissions(p_staff_role text)
returns table(permission_key text)
language plpgsql
stable
security definer
set search_path=public as $$
begin
  if not exists(
    select 1 from public.profiles
    where id=auth.uid()
      and staff_role in ('patron','copatron','responsable_pompiste','responsable_vente')
  ) then
    raise exception 'Vous n’avez pas accès au mode aperçu';
  end if;

  if p_staff_role in ('patron','copatron') then
    return query select unnest(array[
      'orders_view','orders_claim','orders_manage','catalog_manage','packs_manage',
      'announcements_manage','promotions_manage','recruitment_manage','contacts_manage',
      'team_manage','customers_manage','partnerships_manage','settings_manage',
      'business_status_manage','stats_view'
    ]::text[]);
    return;
  end if;

  return query
  select rp.permission_key
  from public.role_permissions rp
  where rp.staff_role=p_staff_role and rp.enabled=true
  order by rp.permission_key;
end; $$;

grant execute on function public.get_preview_role_permissions(text) to authenticated;
