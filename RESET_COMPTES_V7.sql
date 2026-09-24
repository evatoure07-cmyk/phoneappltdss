-- LTD Sandy Shores — RESET UNIQUE DES COMPTES POUR PASSAGE À LA V7
-- ATTENTION : à exécuter UNE SEULE FOIS dans Supabase > SQL Editor.
-- Ce script supprime tous les comptes Auth actuels ainsi que leurs commandes,
-- puis réarme les deux comptes de direction pour leur première connexion.
-- Les produits, packs, annonces, paramètres, promotions et partenariats sont conservés.

begin;

-- Les commandes dépendent des profils clients : on efface l'historique de commande
-- pour pouvoir retirer proprement les comptes de test.
delete from public.order_events;
delete from public.order_items;
delete from public.orders;
delete from public.loyalty_events;

-- Nettoie les anciennes photos de profil de test.
delete from storage.objects where bucket_id='staff-avatars';

-- Supprime tous les utilisateurs Auth. Les profils sont supprimés en cascade.
delete from auth.users;

-- Réarme uniquement les deux accès direction nominatifs.
update public.direction_bootstrap
set used=false,used_at=null
where username in ('luciana.angelmars','blake.mars');

commit;

-- Après ce reset, connectez-vous une première fois avec :
-- luciana.angelmars / Luci#7M2q9Mars!
-- blake.mars          / Blake#4R8m2Mars!
-- Le site recréera automatiquement les deux comptes et demandera un nouveau mot de passe.
