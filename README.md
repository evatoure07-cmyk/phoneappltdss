# LTD Sandy Shores — Site mobile V2

Site mobile pour la boutique, la livraison, la fidélité, les annonces, le recrutement et la gestion interne du LTD Sandy Shores.

## Ce qui est inclus

- Accueil immersif : statut ouvert/fermé, délai estimé, adresse, téléphone, annonces et services.
- Boutique : recherche, catégories, populaires, nouveautés, disponibilité/stock et saisie directe des quantités.
- Panier : quantités modifiables à la main, livraison ou retrait, adresse, téléphone, note, code promo, fidélité et minimum de commande.
- Fidélité : points ajoutés uniquement lorsqu'une commande est terminée ; à 100 points, une livraison peut être offerte.
- Commandes : numéro de commande `SS-XXXXXX`, étapes de suivi, estimation, historique daté, détails, motif d'annulation et bouton pour recommander une ancienne commande.
- Recrutement : postes ouverts et formulaire de candidature.
- Espace équipe : nouvelles commandes, attribution à un seul employé, préparation, commande prête, départ livraison, livraison et annulation avec motif.
- Direction : statistiques détaillées, annonces, produits, stock/disponibilité, promotions activables/désactivables, contacts, paramètres, rôles, points fidélité clients et candidatures.
- Multi-appareils : avec Supabase, tous les PC/téléphones partagent les mêmes commandes et données.
- Mise à jour en direct des commandes via Supabase Realtime.

## 1. Configurer Supabase

1. Crée un projet sur Supabase.
2. Ouvre **SQL Editor** > **New query**.
3. Copie tout le contenu de `supabase.sql` puis clique sur **Run**.
   - Le script est prévu pour mettre à niveau l'ancienne V1 si tu l'avais déjà installée.
4. Dans Supabase > **Project Settings / API**, copie :
   - Project URL
   - clé publique `anon` / publishable
5. Ouvre `config.js` et remplis :

```js
SUPABASE_URL: "https://TON-PROJET.supabase.co",
SUPABASE_ANON_KEY: "TA_CLE_PUBLIQUE",
```

Ne mets jamais une clé `service_role` dans le site.

## 2. Créer le premier compte Direction

1. Ouvre le site et crée ton compte normalement.
2. Dans Supabase > SQL Editor, exécute :

```sql
update public.profiles
set role='admin'
where id=(select id from auth.users where email='TON_EMAIL');
```

Déconnecte-toi puis reconnecte-toi sur le site. Le bouton **Direction** apparaîtra dans ton compte.

Les rôles disponibles sont :
- `customer` : client
- `employee` : employé
- `manager` : responsable
- `admin` : direction principale

## 3. Ajouter les vrais articles

Tu pourras les ajouter directement dans **Compte > Direction > Produit**.

Chaque article peut avoir :
- nom
- prix
- description
- catégorie
- icône/emoji
- stock limité ou illimité
- disponible / indisponible
- populaire
- nouveauté

Quand la vraie carte du LTD sera disponible, remplace les produits exemples par les vrais produits et prix.

## 4. Paramètres modifiables depuis le site

Dans **Direction > Paramètres** :
- ouvrir / fermer les commandes
- frais de livraison
- minimum de commande
- délai estimé
- points gagnés par commande
- nombre de points requis pour la livraison offerte
- adresse
- téléphone
- horaires / message d'ouverture
- jour de recrutement
- activer/désactiver livraison ou retrait

## 5. Déploiement Render

Ce projet est un **site statique**. Sur Render, utilise **Static Site**, pas Web Service.

Si `index.html` est directement à la racine du dépôt GitHub :
- Root Directory : vide
- Build Command : `echo "No build required"`
- Publish Directory : `.`

Si les fichiers sont dans le dossier `ltd_mobile_site` :
- Root Directory : `ltd_mobile_site`
- Build Command : `echo "No build required"`
- Publish Directory : `.`

Il n'y a aucun `Start Command` à mettre pour un Static Site.

## Mode local sans Supabase

Le site fonctionne aussi en mode local avec `localStorage`, mais les données restent uniquement sur l'appareil utilisé. Ce mode sert surtout à tester le design.

Pour tester temporairement les écrans internes sans Supabase, ajoute à l'adresse :

- `?demoRole=employee`
- `?demoRole=manager`
- `?demoRole=admin`

Exemple : `index.html?demoRole=admin`

## Fichiers

- `index.html` : structure du site
- `styles.css` : design mobile
- `app.js` : boutique, commandes, fidélité, comptes, équipe et direction
- `config.js` : connexion Supabase + valeurs de secours
- `supabase.sql` : base de données, sécurité et fonctions serveur
