# CreditFast

Plateforme d’octroi, scoring et gestion microfinance.

<p align="center">
	<img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react" alt="React 19" />
	<img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript 5" />
	<img src="https://img.shields.io/badge/Vite-7-646CFF?style=for-the-badge&logo=vite" alt="Vite 7" />
</p>

Ce projet est une application front moderne construite avec Vite + React + TypeScript. Il coexiste avec des actifs legacy dans `public/js`, tandis que la SPA actuelle est développée dans `src/`.

## ✨ Vue d’ensemble

- Gestion d’authentification et d’inscription
- Espace client, agent, analyste, comité et admin
- Gestion des dossiers, scoring et simulation crédit
- Architecture modulaire par rôle et par domaine métier
- Compatible avec un backend API externe configuré via variables d’environnement

## 🎨 Palette de couleurs

La charte CreditFast suit une règle visuelle **60-30-10** : crème pour les surfaces, vert forêt pour la structure et doré pour les actions importantes.

### Couleurs principales

|                                                     Aperçu                                                              
| Nom        | Code HEX  | Usage  |
:-----------------------------------------------------------------------------------------------------------------------------: | ---------- | --------- | ---------------------------------------------- |
| 
<span style="display:inline-block;width:24px;height:24px;background:#F9F6EB;border:1px solid #D4CCB4;border-radius:4px"></span> 
| Crème      | `#F9F6EB` | Fond principal, canvas, surfaces claires       |
|             
<span style="display:inline-block;width:24px;height:24px;background:#1B4332;border-radius:4px"></span>              
| Vert forêt | `#1B4332` | Navigation, boutons principaux, marque         |
|             
<span style="display:inline-block;width:24px;height:24px;background:#F1CA30;border-radius:4px"></span>              
| Doré       | `#F1CA30` | Accent, appels à l’action, éléments importants |

### Nuances de la marque

| Nom             | Code HEX  | Usage                               |
| --------------- | --------- | ----------------------------------- |
| Vert très clair | `#EEF4EE` | Fonds doux et badges                |
| Vert clair      | `#D5E3D4` | Bordures et surfaces secondaires    |
| Vert moyen      | `#518E45` | États actifs et accent secondaire   |
| Vert profond    | `#0D2818` | Sidebar, texte fort, mode sombre    |
| Doré clair      | `#FFF3B0` | Surbrillance douce                  |
| Doré vif        | `#FFD700` | Accent visuel et indicateurs        |
| Orange          | `#FF9800` | Variante d’accent et avertissements |

### Couleurs sémantiques

| État          | Principal | Fond      | Bordure   |
| ------------- | --------- | --------- | --------- |
| Succès        | `#518E45` | `#EEF4EE` | `#A7F3D0` |
| Avertissement | `#F1CA30` | `#FFF8DC` | `#F4E7C2` |
| Danger        | `#CE1126` | `#FEF2F2` | `#FECACA` |
| Information   | `#1B4332` | `#EEF4EE` | `#A8C5A4` |

### Neutres et texte

| Nom                | Code HEX  | Usage                                    |
| ------------------ | --------- | ---------------------------------------- |
| Blanc cassé        | `#FFFEF8` | Cartes et panneaux                       |
| Surface secondaire | `#F0EBDC` | Zones secondaires                        |
| Bordure            | `#E4DDC8` | Séparateurs et contours                  |
| Texte principal    | `#0D2818` | Titres et contenu prioritaire            |
| Texte secondaire   | `#475569` | Descriptions et informations secondaires |
| Texte discret      | `#94A3B8` | Métadonnées et placeholders              |

Les variables CSS correspondantes sont définies dans [`src/styles/constants.css`](src/styles/constants.css) et réutilisées dans les autres feuilles de style.

## Technologies

| Outil | Rôle |
| --- | --- |
| React 19 | Interface |
| TypeScript 5 | Typage |
| Vite 7 | Serveur de développement et build |
| React Router 7 | Routes et espaces par rôle |
| Tailwind CSS 4 | Styles utilitaires |
| HeroUI et React Aria | Composants et accessibilité |
| API CreditFast | `https://creditfast-api.onrender.com/api` |

Node.js et npm servent à installer les dépendances et à lancer les scripts. Les tests de parcours local sont des scripts `node` dans `scripts/`.

## Démarrage

L’application parle à l’API. Les comptes de démonstration du navigateur ne sont pas utilisés.

```bash
npm install
npm run dev
```

Copier `.env.example` vers `.env` si l’adresse de l’API doit changer :

```env
VITE_API_URL=https://creditfast-api.onrender.com/api
VITE_BACKEND_ENABLED=true
```

Si l’API ne répond pas, la démo live se lance à part, sans toucher au `.env` de l’API :

```bash
npm run demo
```

Elle ouvre http://localhost:5175/ sur le magasin du navigateur. Comptes et mot de passe `demo-local` : [demo-local/README.md](demo-local/README.md).

```bash
npm run dev       # serveur de développement
npm run build     # vérification TypeScript et build
npm run preview   # prévisualisation du build
```

## Structure du projet

```text
.
├── index.html
├── public/                  # images et scripts historiques (public/js)
├── demo-local/              # démo sans API (npm run demo)
├── docs/                    # contrats d’interface et d’API
├── scripts/                 # vérifications des parcours locaux
├── src/
│   ├── main.tsx             # démarrage React
│   ├── App.tsx
│   ├── app/                 # routes, rôles, session
│   ├── api/                 # client HTTP et contrats
│   ├── assets/
│   ├── components/
│   ├── features/            # écrans par domaine
│   │   ├── auth/
│   │   ├── client/
│   │   ├── agent/
│   │   ├── analyst/
│   │   ├── committee/
│   │   ├── admin/
│   │   ├── savings/
│   │   ├── loans/
│   │   ├── assistant/
│   │   ├── modals/
│   │   ├── drawers/
│   │   └── workflow/
│   ├── shared/              # layout, tableaux, champs, montants
│   ├── styles/
│   └── utils/
├── .env.example
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vercel.json
```

Le détail des endpoints est dans [docs/backend-reference.md](docs/backend-reference.md). L’index des autres documents est dans [docs/README.md](docs/README.md).

## Architecture

Le code est organisé selon les responsabilités métier et les rôles utilisateurs :

- `src/app/` : navigation, rôles, session utilisateur, protection des routes
- `src/api/` : appels backend et contrats de données
- `src/features/` : écrans et workflows par rôle (client, agent, analyste, admin, etc.)
- `src/shared/` : composants UI et layout réutilisables
- `src/styles/` : design system et styles globaux

## 🏛️ Rôles principaux

- Client
- Agent
- Analyste
- Comité
- Admin

Chaque rôle dispose d’un espace dédié avec des permissions et des pages spécifiques.

## 📝 Notes

- Les fichiers legacy dans `public/js` sont conservés pour compatibilité ou migration progressive.
- La SPA actuelle est la source de vérité côté interface moderne.
- Les dépendances et la configuration Vite peuvent être ajustées selon l’environnement backend cible.

## 📌 Contribution

Pour contribuer au projet :

1. Créer une branche dédiée
2. Développer localement
3. Vérifier avec `npm run build`
4. Ouvrir une pull request claire avec le contexte fonctionnel
