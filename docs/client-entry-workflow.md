# Accès CreditFast et compte bancaire

## Phase actuelle : validation locale du frontend

Le backend est débranché par défaut. `src/app/runtimeMode.ts` active le mode local tant que `VITE_BACKEND_ENABLED` ne vaut pas explicitement `true`. La présence de `VITE_API_URL` ne suffit pas à activer une connexion. Ne réactiver le backend qu’après validation des processus.

Le transport `src/api/client.ts` dirige les opérations vers `src/api/localWorkflow.ts`, sans repli réseau. Les écrans et formulaires existants restent les supports de validation du futur backend.

Sur la page de connexion, choisir un scénario dans « Atelier des parcours », puis se connecter :

| Scénario | Accès fictif | Situation initiale |
| --- | --- | --- |
| Client avec épargne | +22370000001 | Épargne active, identité présente |
| Client sans épargne | +22370000002 | Ouverture épargne nécessaire |
| Profil à compléter | +22370000003 | Épargne active, identité manquante |
| Agent | agent@demo.creditfast | Contrôle des dossiers et visites |
| Analyste | analyst@demo.creditfast | Revue et transmission au comité |
| Comité | committee@demo.creditfast | Décision sur les demandes |
| Administrateur | admin@demo.creditfast | Validation des ouvertures épargne |

Les mots de passe de démonstration ne sont pas vérifiés ni conservés. L’inscription crée un nouveau profil local sans compte épargne ni pièce. Ces comptes ne permettent aucune connexion bancaire réelle. Les anciennes sessions backend sont ignorées, et les sessions locales sont ignorées lorsque le backend est activé.

Les données sont conservées dans `localStorage` sous `creditfast:local-workflow:v1`, les fichiers déposés dans IndexedDB `creditfast-local-files`. Les rôles partagent les dossiers de ce navigateur afin de tester les transmissions ; les clients voient leurs propres dossiers. Les données ne sont pas partagées entre navigateurs ou ordinateurs. Utiliser uniquement des informations fictives.

Parcours disponibles : connexion/inscription, profil, pièces d’identité, ouverture épargne et décision de l’équipe, création du prêt et pièces/garanties, visites terrain, transmission agent → analyste → comité, décision, versement et remboursement simulés. Le score est un exemple fixe ; les simulations et échéanciers utilisent un intérêt nul pour tester les écrans, sans constituer un barème bancaire.

Les fonctions annexes encore non définies (par exemple gestion des utilisateurs, paramétrage des règles, photo et changement du mot de passe) retournent un message « Étape locale à définir ». Elles ne réussissent pas artificiellement et ne contactent jamais le backend. Les notifications et journaux ne sont pas encore simulés. Le prototype et ses transitions restent à valider fonctionnellement avant d’en déduire les règles définitives du serveur.

Vérification automatisée : `node scripts/test-local-workflow.mjs`, `node scripts/test-savings.mjs`, puis `npm.cmd run build` sous Windows.

## Parcours client

La vue épargne reprend la disposition des références visuelles : indicateurs verticaux, courbe de solde, synthèse des mouvements et colonne latérale de statistiques ; les transactions occupent ensuite toute la largeur. Les graphiques utilisent les opérations comptabilisées de l’année et du mois choisis. Les soldes affichés dans les indicateurs restent les soldes actuels. La courbe utilise uniquement les soldes `balance_after` disponibles ; aucune projection ni croissance fictive n’est ajoutée. Les informations du compte restent accessibles dans un volet dépliable sous le tableau.

Le tableau propose sélection par ligne/page, filtres repliables, pagination (5/10/20 lignes), export CSV des lignes filtrées ou sélectionnées et export individuel. L’export est local et neutralise les cellules susceptibles d’être interprétées comme formules. Le détail reste consultable dans un panneau latéral ; aucune action de modification/suppression d’un mouvement bancaire n’est introduite.

L’historique épargne utilise `GET /profile/financial-accounts/{id}/transactions` dans le transport local. Chaque opération expose référence, date ISO, libellé, type, sens CREDIT/DEBIT, montant positif en FCFA, statut, canal et solde après comptabilisation. Les opérations en attente ou annulées ne participent pas au solde. Recherche par référence/libellé/type, dates inclusives, filtre de type et détail latéral sont disponibles. Les deux comptes initiaux à 500 000 FCFA reçoivent un historique cohérent conservé dans le navigateur ; les nouveaux comptes commencent sans opération. Le transport interdit la lecture du compte d’un autre client. Ce contrat reste à valider avant intégration bancaire.

La page épargne présente le résumé financier par compte : `balance` (solde total), `available_balance` (montant disponible) et `blocked_balance` (montant immobilisé), en FCFA. Une valeur absente reste affichée « — » dans l’interface. Le fournisseur local considère les anciens comptes sans blocage renseigné comme non bloqués et calcule leur disponibilité par différence ; il conserve les comptes et dossiers déjà enregistrés. Le futur backend devra fournir ces montants selon les règles bancaires validées.

Le compte de connexion CreditFast est distinct du client bancaire et de son compte épargne.

À chaque ouverture de l’espace authentifié, le frontend lit `/profile` :

1. Aucun compte épargne actif : orientation vers `/app/client/savings` pour demander son ouverture ou suivre la demande existante.
2. Compte épargne actif : contrôle des pièces du profil via `/profile/kyc-documents`.
3. Pièce d’identité manquante, rejetée ou expirée : orientation vers les documents. Une CNI, NINA ou un passeport est requis. Un dépôt en attente de contrôle permet de préparer une demande ; il ne vaut pas validation KYC.
4. Compte épargne actif et pièce présente : navigation libre dans l’espace client. Le formulaire de prêt s’ouvre uniquement sur une action explicite (« Faire une demande de prêt », reprise de brouillon ou parcours du simulateur). Les règles de soumission et de validation du dossier restent applicables.

Cette vérification d’entrée ne se relance pas lors des changements de page. La navigation ne doit jamais ouvrir automatiquement le formulaire de prêt.

Les erreurs de lecture bloquent la vérification avec possibilité de réessayer. Un compte bancaire existant ne nécessite pas une nouvelle adhésion ni la disponibilité du catalogue des caisses.

## Futur rattachement serveur, après validation des parcours

Les fichiers d’exemple `data_client.cvs` et `data_account.cvs` sont tabulés. La relation bancaire est `data_account.ID_CLIENT → data_client.ID_CLIENT`. Le serveur doit rattacher l’utilisateur authentifié à ce client après vérification de son identité et renvoyer uniquement ses comptes. Un numéro de téléphone saisi seul ne constitue pas une preuve de propriété.

Mapping de l’import bancaire vers `financial_accounts` dans `/profile` :

| Colonne source | Champ API |
| --- | --- |
| NUMERO_COMPTE | account_number |
| TYPE_COMPTE | account_type |
| SOLDE | balance |
| STATUT | status |
| DATE_OUVERTURE | opened_at (date ISO) |

Le frontend accepte `EPARGNE` et les statuts actifs `ACTIF` / `ACTIVE`. Le serveur conserve `ID_CLIENT` et `ID_COMPTE` comme références externes pour éviter les doublons à l’import. La création d’un accès CreditFast ne doit pas recréer un client bancaire existant.

Ce dépôt contient le frontend : aucun import bancaire ni rattachement d’identité n’a été exécuté. Le backend doit aussi imposer les conditions de compte épargne et de pièces obligatoires lors de la soumission du prêt.
