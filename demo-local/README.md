# Démo locale

Ce dossier lance CreditFast sans l’API. Les parcours, comptes et dossiers restent dans le navigateur. `npm run dev` continue d’appeler `https://creditfast-api.onrender.com/api`.

## Lancer

Depuis la racine du projet :

```bash
npm run demo
```

Puis ouvrir http://localhost:5175/

Sur l’écran de connexion, le bloc « Atelier des parcours » propose les comptes. Mot de passe : `demo-local`. Il n’est pas vérifié.

## Données

La liste des comptes est dans [comptes.json](comptes.json). Le détail des soldes et des pièces est dans [docs/test-users.md](../docs/test-users.md).

Le moteur qui répond aux écrans est `src/api/localWorkflow.ts`. Au premier passage, il enregistre le magasin sous la clé `creditfast:local-workflow:v1`. Pour retrouver un magasin frais, effacer cette clé dans le stockage local du navigateur, puis recharger.

Aucun appel ne part vers l’API tant que cette commande tourne. Le fichier `.env` de la racine n’est pas lu.
