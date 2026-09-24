# LTD Sandy Shores — V7

Cette V7 simplifie la gestion du LTD et corrige la synchronisation multi-utilisateurs.

## Ce qui change

- un seul panel **Administration > Comptes** pour voir tous les comptes clients et employés ;
- la liste des comptes est récupérée depuis **Supabase Auth**, puis synchronisée avec `profiles` : un compte créé ne doit plus disparaître du panel ;
- filtres **Tous / Employés / Clients** + recherche ;
- modification du nom, téléphone et rôle des employés ;
- réinitialisation du mot de passe des employés ;
- lien de réinitialisation par email pour les clients ;
- suppression d’un compte non-direction depuis le panel ;
- création d’un employé avec seulement **Prénom + Nom** : l’identifiant `prenom.nom` est créé automatiquement ;
- suppression de l’ancienne page **Espace équipe** ;
- accueil différent pour les employés : statut ouvert/fermé, commandes et accès rapides ;
- bouton **Ouvrir / Fermer le LTD** directement sur l’accueil employé (permission configurable par rôle) ;
- catalogue admin simplifié : le bouton **Ajouter un produit** est directement dans **Catalogue** ;
- annuaire des employés sur l’accueil, trié du poste le plus gradé au moins gradé ;
- le numéro d’un employé reste privé tant qu’il n’a pas activé l’option dans son profil ;
- la section « Nouvelles arrivées » est remplacée par **Produit du mois** ;
- suppression de la mention « Convenience Store » ;
- synchronisation temps réel des commandes, produits, annonces, statut ouvert/fermé, recrutement, contacts, profils et promotions entre les téléphones/PC.

## Direction

- **Blake Mars** — Gérant — `blake.mars`
- **Luciana Angel Mars** — Cogérante — `luciana.angelmars`

Ils ont exactement les mêmes accès complets.

Après le reset V7, les mots de passe temporaires sont :

- `blake.mars` → `Blake#4R8m2Mars!`
- `luciana.angelmars` → `Luci#7M2q9Mars!`

À la première connexion, le site oblige à les remplacer.

## Installation / mise à jour

1. Remplace les fichiers GitHub par ceux de cette V7.
2. Dans **Supabase > SQL Editor**, exécute entièrement `supabase.sql`.
3. Déploie à nouveau la fonction `admin-users` avec le fichier `supabase/functions/admin-users/index.ts`.
4. La fonction `admin-users` doit garder **Verify JWT désactivé** : les actions sensibles contrôlent elles-mêmes la session et le rôle de direction.
5. Redéploie le site Render.

### Reset des anciens comptes demandé pour cette V7

Tu as demandé de supprimer les comptes de test existants et de repartir uniquement avec Luciana et Blake.

Après avoir exécuté `supabase.sql`, exécute **UNE SEULE FOIS** `RESET_COMPTES_V7.sql` dans **Supabase > SQL Editor**.

Ce reset :

- supprime tous les anciens comptes Auth et profils ;
- supprime l’historique de commandes lié aux anciens comptes pour éviter les conflits de clés étrangères ;
- conserve produits, packs, annonces, paramètres, promotions et partenariats ;
- réarme les accès `luciana.angelmars` et `blake.mars`.

Ensuite, connecte-toi une première fois avec l’un des deux identifiants direction ci-dessus. Le site recréera automatiquement le compte nominatif correspondant.

## Création d’un employé

Dans **Administration > Comptes > Créer un compte employé** :

1. renseigne Prénom ;
2. renseigne Nom ;
3. renseigne le téléphone ;
4. choisis le rôle ;
5. garde ou change le mot de passe temporaire proposé.

L’identifiant est automatiquement calculé en `prenom.nom`. Il n’y a plus de champ identifiant à remplir manuellement.

Rôles disponibles : Vendeur novice, Vendeur intermédiaire, Vendeur expérimenté, Pompiste novice, Pompiste intermédiaire, Pompiste expérimenté, Chef d’équipe, Livreur, Responsable pompiste et Responsable vente.

Les droits restent configurables dans **Administration > Permissions**.

## Clients

Les habitants créent eux-mêmes leur compte avec leur email et leur propre mot de passe. Ils apparaissent ensuite dans **Administration > Comptes > Clients**.

La direction peut modifier leurs informations visibles, gérer leur fidélité et envoyer un lien de récupération de mot de passe. Le mot de passe actuel d’un client n’est jamais affiché.

Pour les liens de récupération, ajoute l’URL Render du site dans **Supabase > Authentication > URL Configuration > Redirect URLs**.

## Important pour plusieurs utilisateurs en même temps

La V7 utilise Supabase comme source centrale et ajoute les tables principales à Supabase Realtime. Une modification faite sur un téléphone/PC (statut du LTD, commande, produit, annonce, profil, etc.) déclenche un rafraîchissement chez les autres utilisateurs connectés.

Ne mets jamais la clé `service_role` dans `config.js`. Elle doit rester uniquement dans l’environnement sécurisé de la fonction Supabase `admin-users`.
