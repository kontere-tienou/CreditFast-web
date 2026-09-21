# CreditFast - Plateforme d'Octroi, Scoring & Conformité Microfinance

Ce dépôt contient déjà l’application Vite + React + TypeScript à la racine du projet. Les actifs legacy de l’ancienne interface restent dans `public/js`, tandis que la nouvelle SPA est développée dans `src/`.

```bash
npm install
npm run dev
```

API base URL: `.env.example` (`VITE_API_URL`).

## 📁 Structure actuelle du projet

```text
.
├── index.html                     # Entrée HTML de l’app Vite
├── public/
│   ├── images/
│   └── js/
│       ├── constants.js
│       ├── data.js
│       ├── credit-scoring.js
│       ├── ocr-engine.js
│       ├── charts.js
│       ├── interactions.js
│       └── app.js
├── src/
│   ├── app/
│   ├── api/
│   ├── components/
│   ├── features/
│   ├── shared/
│   ├── styles/
│   ├── utils/
│   ├── App.tsx
│   ├── main.tsx
│   └── vite-env.d.ts
├── scripts/
├── .env
├── .env.example
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vercel.json
└── README.md
```

## 🧩 Architecture Modulaire par Rôle & Utilisateur

Le projet est structuré avec une séparation claire et modulaire des dossiers selon les rôles utilisateurs et les domaines fonctionnels :

```text
├── src/
│   ├── app/                           # Session, routing, legacy bridge, role permissions
│   ├── api/                           # Accès API & types
│   ├── components/                    # Composants UI atomiques / applicatifs
│   ├── features/                      # Pages et modules métier par rôle
│   ├── shared/                        # Layout, tables, UI partagée
│   ├── styles/                       # Styles globaux du shell React
│   ├── utils/
│   ├── App.tsx
│   ├── main.tsx
│   └── vite-env.d.ts
│
├── public/
│   ├── images/
│   └── js/                            # Legacy scripts & données statiques
│       ├── constants.js
│       ├── data.js
│       ├── credit-scoring.js
│       ├── ocr-engine.js
│       ├── charts.js
│       ├── interactions.js
│       └── app.js
│
├── scripts/
├── .env                              # Variables d’environnement locales
├── .env.example
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vercel.json
├── index.html
└── README.md
```
