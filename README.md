# LTD Sandy Shores — site mobile RP

Site mobile-first pour GTA RP : accueil du LTD, annonces, catalogue, livraison, comptes clients, fidélité, suivi de commande, espace employé et administration.

## Ce qui fonctionne déjà
- Accueil complet avec annonces et informations du LTD
- Boutique filtrable par catégories
- Panier et livraison à 100 $
- Création de compte / connexion
- Fidélité : 10 points par commande livrée, 100 points = livraison offerte
- Historique et statut des commandes
- Espace employé : accepter / préparer / mettre en livraison / livrer / annuler
- Espace admin : publier des annonces et ajouter des produits
- Recrutement du dimanche déjà affiché
- Mode démo local si Supabase n'est pas encore configuré

## Mise en ligne la plus simple
1. Crée un projet Supabase.
2. Dans `SQL Editor`, colle le contenu de `supabase.sql` puis exécute-le.
3. Dans Supabase > Project Settings > API, copie `Project URL` et `anon public key`.
4. Colle-les dans `config.js`.
5. Mets tout le dossier sur GitHub puis déploie avec Netlify, Vercel ou GitHub Pages.
6. Crée ton compte sur le site.
7. Dans Supabase SQL Editor, exécute la dernière requête commentée de `supabase.sql` avec ton email pour passer ton compte en `admin`.

## Quand tu m'enverras la carte du LTD
Je pourrai remplacer les articles d'exemple par les vrais articles, prix, catégories et visuels. Le site n'aura pas besoin d'être refait.

## Paramètres faciles à changer
Dans `config.js` :
- `DELIVERY_FEE: 100`
- `LOYALTY_REWARD_POINTS: 100`
- `POINTS_PER_COMPLETED_ORDER: 10`
- nom et adresse RP du LTD

## Important
Les clés Supabase `anon` sont prévues pour être publiques. La sécurité repose sur les règles RLS incluses dans `supabase.sql`. Ne mets jamais de `service_role key` dans `config.js`.
