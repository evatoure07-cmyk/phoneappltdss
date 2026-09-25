# LTD Sandy Shores — V8

Cette V8 corrige la création des comptes et ajoute le mode **Voir comme…**.

## Correction importante : comptes réellement enregistrés

La V7 pouvait basculer silencieusement en mode local lorsque `SUPABASE_URL` et `SUPABASE_ANON_KEY` n'étaient pas renseignés dans `config.js`. Un compte semblait alors créé sur un appareil sans exister dans la base commune.

En V8 :

- la création de comptes clients et employés exige la base centrale Supabase ;
- si Supabase n'est pas configuré, le site affiche clairement **Base centrale non connectée** et bloque la création de comptes locaux ;
- après la création d'un employé, le site demande immédiatement à la fonction serveur de relire ce compte dans Supabase ;
- le message **Compte enregistré** n'apparaît que si le compte existe réellement dans Supabase Auth + `profiles` ;
- le bouton **Voir dans Comptes** recharge immédiatement le panel centralisé ;
- les erreurs de la fonction `admin-users` sont maintenant affichées de manière plus précise.

Tous les comptes restent centralisés dans **Administration > Comptes**.

## Mode « Voir comme… »

Disponible uniquement pour :

- Gérant (`patron`) ;
- Cogérante (`copatron`) ;
- Responsable pompiste ;
- Responsable vente.

Le bouton est disponible dans **Mon compte** et dans **Administration**.

Vues disponibles : Client, Vendeur novice/intermédiaire/expérimenté, Pompiste novice/intermédiaire/expérimenté, Chef d'équipe, Livreur, Responsable pompiste et Responsable vente.

Le mode aperçu :

- change l'accueil et les outils affichés selon le rôle choisi ;
- respecte les permissions configurées pour le rôle ;
- n'altère jamais le vrai compte ni le vrai rôle ;
- bloque toutes les modifications pendant l'aperçu ;
- affiche une bannière persistante **Aperçu : …** avec un bouton pour revenir à la vue réelle ;
- n'affiche pas l'historique réel du compte direction dans la vue Client.

## Mise à jour V7 → V8

1. Remplace `index.html`, `styles.css` et `app.js` par ceux de la V8.
2. **Si ton `config.js` contient déjà ton URL Supabase et ta clé anon, garde ton fichier actuel. Ne le remplace pas par le `config.js` vierge du ZIP.**
3. Dans **Supabase > SQL Editor**, exécute le nouveau `supabase.sql` (il ajoute notamment `get_preview_role_permissions`).
4. Redéploie la fonction **admin-users** avec `supabase/functions/admin-users/index.ts`.
5. Garde **Verify JWT désactivé** pour `admin-users` comme dans la V7 ; la fonction vérifie elle-même la session et le rôle de direction.
6. Redéploie Render.

## Vérification de la base centrale

Dans `config.js`, ces deux valeurs doivent être renseignées :

```js
SUPABASE_URL: "https://TON-PROJET.supabase.co",
SUPABASE_ANON_KEY: "TA_CLE_ANON",
```

La clé `service_role` ne doit **jamais** être mise dans `config.js`. Elle reste uniquement dans les variables secrètes de la fonction Supabase `admin-users`.

Si les deux valeurs ci-dessus sont vides, la V8 affiche un avertissement et empêche volontairement la création de comptes afin d'éviter de faux comptes enregistrés uniquement dans un navigateur.

## Test rapide après déploiement

Connecte-toi avec Blake ou Luciana, ouvre **Administration > Comptes**, crée un compte test avec Prénom + Nom + rôle. Le site doit afficher **Enregistré dans Supabase**, puis le compte doit apparaître immédiatement lorsque tu cliques **Voir dans Comptes**. En ouvrant le site depuis un autre appareil avec le même Supabase, ce compte sera également visible dans la liste.
