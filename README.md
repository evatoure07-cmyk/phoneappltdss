# LTD Sandy Shores — V6

Cette version garde le design et les fonctions de la V5, mais remplace les anciens codes d’accès par de vrais **comptes nominatifs employés**.

## Connexion

### Clients
Les habitants créent eux-mêmes leur compte avec leur **email** et le **mot de passe de leur choix**. Ils n’utilisent jamais de mot de passe temporaire à l’inscription.

### Équipe LTD
Les employés se connectent avec un identifiant au format **prénom.nom** et un mot de passe.

- La direction crée les comptes employés depuis **Administration > Équipe & comptes**.
- Le premier mot de passe est temporaire.
- À la première connexion, le site oblige l’employé à choisir un nouveau mot de passe.
- Le Gérant et la Cogérante peuvent réinitialiser le mot de passe d’un employé ; le nouveau mot de passe redevient temporaire jusqu’à son changement.

Les anciens codes Patron / Co-patron et les codes employés de la V5 sont désactivés par la migration V6.

## Direction

Les deux comptes initiaux sont :

- **Blake Mars** — Gérant — identifiant `blake.mars`
- **Luciana Angel Mars** — Cogérante — identifiant `luciana.angelmars`

Leurs mots de passe temporaires ne sont pas stockés en clair dans les fichiers. Ils ont été fournis séparément dans la conversation. À la première connexion, le changement de mot de passe est obligatoire.

Gérant et Cogérante ont exactement les mêmes droits complets.

## Comptes clients et réinitialisation

Dans **Administration > Clients**, la direction peut :

- consulter les comptes clients ;
- voir les points fidélité ;
- ajuster les points ;
- envoyer un **email de réinitialisation du mot de passe**.

La direction ne voit jamais le mot de passe actuel d’un client.

## Installation V6

1. Remplace les fichiers GitHub par ceux de cette V6.
2. Dans Supabase, ouvre **SQL Editor**, colle tout `supabase.sql`, puis exécute-le.
3. Vérifie `config.js` : uniquement l’URL Supabase et la clé publique `anon`.
4. Déploie la fonction Supabase `admin-users` fournie dans :
   `supabase/functions/admin-users/index.ts`.
   **Important : désactive “Verify JWT” pour cette fonction.** Le bootstrap initial de la direction doit fonctionner avant la première connexion ; les actions sensibles vérifient ensuite elles-mêmes que l’appelant est Gérant ou Cogérante.
5. Redéploie le site Render.

### Déployer la fonction depuis le Dashboard Supabase

Dans ton projet Supabase :

1. **Edge Functions** → **Deploy a new function**.
2. Nom : `admin-users`.
3. Remplace le code par le contenu du fichier `supabase/functions/admin-users/index.ts`.
4. Désactive **Verify JWT** pour cette fonction, puis déploie.

Les secrets `SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` sont utilisés **uniquement dans la fonction serveur**. Ne copie jamais la clé `service_role` dans `config.js` ou dans le JavaScript du site.

## Premier accès direction

Une fois `supabase.sql` exécuté et la fonction `admin-users` déployée :

1. Ouvre **Espace employés**.
2. Connecte-toi avec `blake.mars` ou `luciana.angelmars` et le mot de passe temporaire fourni.
3. Le site crée le compte direction lors de cette première connexion.
4. Un écran oblige immédiatement à remplacer le mot de passe temporaire.
5. Ensuite : **Administration > Équipe & comptes** pour créer les autres employés.

## Création d’un employé

Dans **Administration > Équipe & comptes** :

1. indique prénom, nom, téléphone et rôle ;
2. l’identifiant suit le format `prenom.nom` ;
3. le site génère un mot de passe temporaire sécurisé ;
4. transmets l’identifiant et le mot de passe à l’employé ;
5. lors de sa première connexion, il doit changer le mot de passe.

Rôles disponibles : Vendeur novice, Vendeur intermédiaire, Vendeur expérimenté, Pompiste novice, Pompiste intermédiaire, Pompiste expérimenté, Chef d’équipe, Livreur, Responsable pompiste et Responsable vente.

Les permissions de ces rôles restent configurables par cases à cocher dans **Administration > Permissions**.


### Réinitialisation des clients

Pour que les liens de récupération reviennent correctement vers le site, ajoute aussi l’URL Render de ton site dans **Supabase > Authentication > URL Configuration > Redirect URLs**.
