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

## 🚀 Démarrage rapide

```bash
npm install
npm run dev
```

Puis ouvrir l’URL affichée par Vite dans le terminal.

## 🧪 Scripts disponibles

```bash
npm run dev      # démarre le serveur de développement
npm run build    # construit la version de production
npm run preview  # prévisualise le build localement
```

## ⚙️ Configuration

Le projet utilise un fichier d’environnement. Consultez `.env.example` pour la configuration de l’API :

```env
VITE_API_URL=http://localhost:3000
```

## 📁 Structure du projet

```text
.
├── index.html                   # Entrée HTML de l’application Vite
├── public/
│   ├── images/
│   └── js/                     # Scripts legacy et assets historiques
│       ├── app.js
│       ├── charts.js
│       ├── constants.js
│       ├── credit-scoring.js
│       ├── data.js
│       ├── interactions.js
│       ├── ocr-engine.js
│       └── ...
├── src/
│   ├── app/                    # routing, rôles, session, bridge legacy
│   ├── api/                    # appels API et types
│   ├── components/             # composants réutilisables
│   ├── features/               # modules métier par rôle
│   ├── shared/                 # layout, tables, UI partagée
│   ├── styles/                 # styles globaux et thème
│   ├── utils/
│   ├── App.tsx
│   ├── main.tsx
│   └── vite-env.d.ts
├── scripts/
├── .env
├── .env.example
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
├── vercel.json
├── README.md
└── package-lock.json
```

## 🧩 Architecture modulaire

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
