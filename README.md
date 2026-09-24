# LTD Sandy Shores — Site mobile V3

Site officiel mobile du LTD Sandy Shores : vitrine, catalogue, packs, nouveautés, commandes, fidélité, recrutement, partenariats et gestion interne.

## Nouveautés de la V3

- Accueil de type **site officiel**, et non plus simple site de livraison.
- Deux actions principales : **Découvrir le catalogue** et **Devenir partenaire**.
- Accès rapides depuis l'accueil : Nouveautés, Catalogue, Packs, Suivi, Recrutement, Mon panier, Contact et Partenariat.
- Sections **Produits du mois** et **Nouvelles arrivées** directement sur l'accueil.
  - Les produits marqués `Populaire` servent de sélection pour Produits du mois.
  - Les produits marqués `Nouveauté` apparaissent dans Nouvelles arrivées.
- Page **Packs** : les produits dont la catégorie contient `Pack` apparaissent automatiquement.
- Page **Recrutement** séparée avec postes disponibles et candidature.
- Page **Contact** séparée avec adresse, horaires et responsables.
- Page **Devenir partenaire** avec formulaire entreprise / contact / type de partenariat / demande.
- Espace Direction : nouvelle rubrique **Partenariats** pour consulter et traiter les demandes.
- Barre du bas : Accueil, Catalogue, Panier, Suivi et Contact.

## Fonctionnalités déjà présentes

- Catalogue : recherche, catégories, stock, disponibilité et saisie directe des quantités.
- Panier : quantités modifiables, livraison ou retrait, adresse, téléphone, note, code promo, fidélité et minimum de commande.
- Fidélité : points ajoutés lorsqu'une commande est terminée ; à 100 points, une livraison peut être offerte.
- Commandes : numéro `SS-XXXXXX`, suivi, estimation, historique, annulation et bouton Recommander.
- Espace équipe : attribution des commandes, préparation, commande prête, départ livraison et livraison.
- Direction : statistiques, annonces, produits, stock, promotions, contacts, paramètres, rôles, fidélité, candidatures et partenariats.
- Multi-appareils via Supabase.

## 1. Mettre à jour Supabase

Ouvre **Supabase > SQL Editor > New query**, copie tout le fichier `supabase.sql`, puis clique sur **Run**.

Le script est prévu pour mettre à niveau une installation V1/V2. La V3 ajoute notamment la table `partnership_requests`.

Ensuite, dans `config.js`, renseigne :

```js
SUPABASE_URL: "https://TON-PROJET.supabase.co",
SUPABASE_ANON_KEY: "TA_CLE_PUBLIQUE",
```

Ne mets jamais une clé `service_role` dans le site.

## 2. Créer le premier compte Direction

Crée ton compte normalement sur le site puis, dans le SQL Editor :

```sql
update public.profiles
set role='admin'
where id=(select id from auth.users where email='TON_EMAIL');
```

Déconnecte-toi puis reconnecte-toi.

Rôles :
- `customer` : client
- `employee` : employé
- `manager` : responsable
- `admin` : direction

## 3. Configurer les produits de l'accueil

Dans **Compte > Direction > Produit** :

- coche **Populaire** pour faire remonter un produit dans **Produits du mois** ;
- coche **Nouveauté** pour l'afficher dans **Nouvelles arrivées** ;
- utilise une catégorie contenant le mot **Pack** pour l'afficher automatiquement dans la page **Packs**.

Quand la vraie carte du LTD sera disponible, remplace les produits exemples par les vrais produits et prix.

## 4. Paramètres modifiables depuis le site

Dans **Direction > Paramètres** :

- ouvrir / fermer les commandes ;
- frais de livraison ;
- minimum de commande ;
- délai estimé ;
- points gagnés ;
- seuil de livraison offerte ;
- adresse ;
- téléphone ;
- horaires ;
- jour de recrutement ;
- livraison et retrait.

## 5. Déploiement Render

Utilise un **Static Site**, pas un Web Service.

Si `index.html` est à la racine du dépôt :
- Root Directory : vide
- Build Command : `echo "No build required"`
- Publish Directory : `.`

Si les fichiers sont dans `ltd_mobile_site` :
- Root Directory : `ltd_mobile_site`
- Build Command : `echo "No build required"`
- Publish Directory : `.`

Aucun **Start Command** n'est nécessaire.

## Mode local

Sans Supabase, le site fonctionne avec `localStorage` uniquement sur l'appareil utilisé.

Pour tester les écrans internes :
- `?demoRole=employee`
- `?demoRole=manager`
- `?demoRole=admin`

## Fichiers

- `index.html` : structure du site
- `styles.css` : design mobile
- `app.js` : catalogue, panier, commandes, partenariats, recrutement, équipe et direction
- `config.js` : configuration
- `supabase.sql` : base de données et sécurité

## V4 — refonte visuelle “site de marque”

Cette version conserve toute la logique de la V3 et refond principalement l’expérience visuelle : accueil éditorial, accès rapides catalogue/suivi/packs/nouveautés/panier, mise en avant des produits du mois et nouvelles arrivées, blocs partenariat/recrutement, informations du magasin et pied de page de site officiel.

Aucune migration Supabase supplémentaire n’est nécessaire si la base V3 a déjà été installée.
