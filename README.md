# LTD Sandy Shores — Mobile V5

Cette version transforme la V4 en site officiel + espace employés complet.

## Nouveautés V5

- Bouton **Espace employés** dans le site.
- Comptes employés activés avec un **code d'accès**.
- Rôles disponibles : Patron, Co-patron, Vendeur novice / intermédiaire / expérimenté, Pompiste novice / intermédiaire / expérimenté, Chef d'équipe, Livreur, Responsable pompiste et Responsable vente.
- Patron et Co-patron ont **exactement les mêmes droits** et peuvent générer des codes employés.
- Gestion des permissions par rôle avec des **cases à cocher**.
- Profil employé : photo, nom, téléphone, petite présentation et choix d'afficher ou non son numéro dans les contacts publics.
- Annonces : titre + texte, publication et suppression depuis l'administration.
- Recrutement : plus de candidature sur le site. La direction choisit si Vendeur/Vendeuse, Pompiste et Livreur/Livreuse **recrutent / ne recrutent pas**.
- Packs : création d'un pack, prix, description, composition détaillée, quantités et **Pack du mois**.
- Animations de changement de page, modales et cartes.
- Les accès sensibles sont contrôlés par Supabase/RLS : masquer un bouton dans le navigateur ne suffit pas pour obtenir un droit.

## Installation / mise à jour

1. Remplace les fichiers de ton dépôt GitHub par ceux de ce dossier.
2. Dans Supabase : **SQL Editor > New query**.
3. Copie tout le contenu de `supabase.sql` puis clique sur **Run**.
4. Vérifie que `config.js` contient toujours ton URL Supabase et ta clé `anon`.
5. Redéploie ton Static Site Render.

Le script SQL est prévu pour mettre à jour la V4/V3 sans supprimer les commandes ou les comptes existants.

## Premier accès Patron / Co-patron

Les deux codes initiaux ne sont **pas écrits en clair dans les fichiers du site**. `supabase.sql` contient uniquement leurs empreintes cryptographiques. Garde les codes que ChatGPT t'a fournis dans la conversation en privé.

Pour activer un compte direction :

1. Ouvre **Espace employés**.
2. Clique sur **Créer mon compte équipe**.
3. Renseigne nom, téléphone, email, mot de passe et le code Patron ou Co-patron.
4. Une fois connecté, ouvre **Administration > Équipe & accès** pour générer les codes des autres employés.

> Si Supabase demande une confirmation d'email, confirme l'email puis reconnecte-toi. Le site conservera temporairement le code pour l'activer à la connexion suivante.

## Permissions

Dans **Administration > Permissions**, Patron ou Co-patron choisit un rôle puis coche les accès souhaités : commandes, catalogue, packs, annonces, promotions, recrutement, contacts, équipe, clients, partenariats, paramètres et statistiques.

Les droits Patron / Co-patron sont toujours complets et ne peuvent pas être réduits.

## Recrutement

Dans **Administration > Recrutement**, active ou désactive chaque poste. Le public voit alors :

- `RECRUTE`
- `NE RECRUTE PAS`

Le site ne possède plus de formulaire de candidature pour ces postes : les candidats doivent venir directement au LTD.

## Photos de profil

Les photos utilisent le bucket Supabase public `staff-avatars`, créé automatiquement par `supabase.sql`. Chaque employé ne peut modifier que les fichiers de son propre dossier.

## Packs

Dans **Administration > Packs** :

- crée ou modifie un pack ;
- choisis son prix ;
- sélectionne les produits contenus ;
- indique les quantités ;
- coche **Pack du mois** pour le mettre en avant.

Un seul pack doit être mis en avant à la fois : quand un nouveau Pack du mois est enregistré, les anciens sont automatiquement désélectionnés.

## Sécurité importante

- Ne mets jamais la clé `service_role` Supabase dans `config.js` ou dans GitHub.
- Seule la clé publique `anon` doit être utilisée dans le navigateur.
- Les codes Patron / Co-patron doivent rester privés.
- Les codes employés générés depuis l'administration peuvent être configurés pour une ou plusieurs utilisations.
