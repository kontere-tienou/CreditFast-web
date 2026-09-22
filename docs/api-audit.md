# Audit des endpoints CreditFast — 22 septembre 2026

Source : [documentation Swagger](https://creditfast-api.onrender.com/api/documentation), [schéma téléchargé](https://creditfast-api.onrender.com/docs?api-docs.json), [copie auditée](api-audit-openapi.json).

## Périmètre et niveau de preuve

Audit du code présent dans src/ et recherche complémentaire dans public/js/. Correspondance méthode + chemin, fonctions appelantes, formulaires, champs, rôles et gestion des réponses/erreurs. Les paramètres d’URL sont normalisés ; la mise à jour multipart des garanties est comptée comme PUT via _method. Aucun compte de test connecté n’a été utilisé et aucune écriture réelle n’a été exécutée. « Raccordé » ne signifie pas « validé en production ». Les limites ci-dessous sont des écarts de code/contrat ; les routes absentes de Swagger ne sont pas déclarées inexistantes sur le serveur.

## Résultat

93 opérations documentées ; 85 ont un appel frontend correspondant, dont 83 avec un appelant détecté et 2 adaptateurs sans appelant. 8 opérations documentées sont absentes. 8 autres appels frontend concernent des routes épargne non documentées.

| Classement | Opérations |
|---|---:|
| Partiel / à corriger | 23 |
| Raccordé — aucun écart relevé | 60 |
| Adaptateur inutilisé | 2 |
| Absent du frontend | 8 |

Les catégories sont exclusives. Un endpoint marqué partiel peut fonctionner dans certains parcours. Les champs facultatifs non exposés et les plafonds de pagination ne sont pas des erreurs bloquantes sur tous les dossiers.

## Constats et corrections à prioriser

### F01 — Visites terrain absentes

Les 8 routes field-visits existent dans le contrat mais aucun appel frontend ne les utilise. AgentInspectionsPage repose sur les garanties. saveInspectionReport ne transmet que verification_status et verified_value à /agent/guarantees/{id}/verify, pas un rapport de visite. Ajouter modèle, API, liste, planning, détail, démarrage, clôture, annulation/no-show et notifications FIELD_VISIT.

Preuve : [src/features/agent/fillAgentDrawers.ts:1441](../src/features/agent/fillAgentDrawers.ts#L1441).

### F02 — Rôles de création/soumission de crédit

submitCreditRequest appelle requireActiveSavingsAccount, qui consulte /profile réservé au client. Le contrôle ne doit pas utiliser le profil du staff pour le compte du demandeur. Les boutons « nouvelle demande » côté agent ouvrent par ailleurs un parcours dont POST /credit-requests est réservé au client. Prévoir un parcours staff autorisé par le backend ou limiter ces actions.

Preuve : [src/api/credit.ts:247](../src/api/credit.ts#L247).

### F03 — Connexion et erreurs

Ne pas supprimer les espaces du mot de passe : ils peuvent faire partie du secret. Préserver la distinction entre identifiants incorrects, validation, limitation de débit et panne serveur. Le comportement trim() a été reproduit hors réseau.

Preuve : [src/api/auth.ts:81](../src/api/auth.ts#L81).

### F04 — Lecture du score avec effet de bord

loadCreditAnalysis relance POST /score après toute erreur de lecture (403, réseau, etc.). Ce helper est aussi appelé côté comité, non autorisé au calcul. Distinguer lecture et calcul explicite ; ne pas recalculer sur refus d’accès ou panne. Le fallback après 403 a été reproduit hors réseau.

Preuve : [src/api/credit.ts:566](../src/api/credit.ts#L566).

### F05 — Échec KYC masqué

listAgentClientKycDocuments capture toute erreur et retourne []. L’interface peut donc annoncer une absence de pièces alors que la lecture a échoué. Afficher un état d’échec avec reprise. Comportement reproduit hors réseau.

Preuve : [src/api/agent.ts:157](../src/api/agent.ts#L157).

### F06 — Journal d’audit incomplet / rôles

GET /admin/audit-logs est paginé, mais une seule requête est faite. AuditLogsPage l’appelle aussi depuis analyste/comité alors que Swagger autorise admin uniquement ; l’écran affiche alors une indisponibilité. Ajouter pagination et aligner les accès.

Preuve : [src/api/admin.ts:289](../src/api/admin.ts#L289).

### F07 — Modification du profil partielle

PUT /profile supporte les informations société, non proposées dans UpdateClientProfilePayload. EditProfileModal peut aussi actualiser email/phone dans la session alors que le payload client ne les sauvegarde pas ; les rendre non éditables ou prévoir une route autorisée avant d’annoncer la sauvegarde.

Preuve : [src/features/modals/EditProfileModal.tsx:245](../src/features/modals/EditProfileModal.tsx#L245).

### F08 — Mode de scoring retiré

Le schéma actuel accepte uniquement STANDARD et indique explicitement le retrait du Cold Start. AdminScoringPage propose encore COLD_START. Retirer cette option et aligner les types/anciens textes du parcours.

Preuve : [src/features/admin/AdminScoringPage.tsx:162](../src/features/admin/AdminScoringPage.tsx#L162).

### F09 — Champs facultatifs non exposés

Règles de scoring : facteur activity_vitality et paramètres avancés absents. Simulation : other_income absent du payload typé. À compléter si ces capacités doivent être accessibles ; les champs obligatoires sont présents.

Preuve : [src/api/admin.ts:294](../src/api/admin.ts#L294).

### F10 — Catalogue de secours non filtré

Si /credit-products échoue ou renvoie une liste vide, LoanApplicationModal propose la totalité des types statiques. Risque de choix incompatible avec le type de demandeur et de rejet à la création. Garder un état d’erreur/reprise ou filtrer avec une source fiable.

Preuve : [src/features/modals/LoanApplicationModal.tsx:12](../src/features/modals/LoanApplicationModal.tsx#L12).

### F11 — Comptes en attente sans activation documentée

La saisie agent utilise une route existante et envoie PENDING. La validation repose sur des routes admin préparées mais absentes du Swagger actuel. Le parcours complet dépend du contrat savings-api.md ; ne pas le classer opérationnel de bout en bout.

Preuve : [src/features/agent/AgentClientSheet.tsx:145](../src/features/agent/AgentClientSheet.tsx#L145).

### F12 — Notifications partielles

Le serveur documente une liste paginée. Le frontend ne charge que la première page et en affiche 12. FIELD_VISIT est documenté mais n’a pas de libellé ni de lien dédié. Les nouveaux types SAVINGS_MEMBERSHIP_* attendent leur émission par le backend.

Preuve : [src/features/workflow/NotificationBell.tsx:26](../src/features/workflow/NotificationBell.tsx#L26).

### F13 — Multipart à valider en intégration

PUT garantie avec fichier utilise POST et _method=PUT. Le test hors réseau confirme cette émission, mais Swagger ne documente que PUT JSON/multipart. Vérifier la convention serveur avant de déclarer le remplacement de fichier entièrement validé.

Preuve : [src/api/credit.ts:431](../src/api/credit.ts#L431).

### F14 — Plafonds de pagination

Dossiers, clients et prêts : maximum 20 pages ; utilisateurs : 50 pages. La troncature n’est pas annoncée. Prévoir une pagination UI ou signaler la limite ; tester des réponses multi-pages.

Preuve : [src/api/credit.ts:206](../src/api/credit.ts#L206).

### Hors inventaire — Rendez-vous client simulé

handleBookAppointmentModal dans le legacy affiche « Rendez-vous confirmé » et « SMS de rappel envoyé » sans requête réseau. Les nouvelles routes field-visits sont réservées agent/admin, elles ne suffisent pas à autoriser directement une réservation client. Ne pas présenter une réservation comme persistée sans route client ou workflow staff.

Preuve : [public/js/app.js:7606](../public/js/app.js#L7606).

## Inventaire endpoint par endpoint

Le préfixe /api est celui de la documentation. Les appels frontend utilisent VITE_API_URL comme base. Les références « appels » peuvent être des helpers intermédiaires ; elles constituent une preuve de raccordement statique, pas un test de navigation dans chaque écran.

### Administration

| Méthode et endpoint | État | Implémentation / appelant | Vérification ou reste à faire |
|---|---|---|---|
| `GET /api/admin/users` | Partiel / à corriger | [src/api/admin.ts:210](../src/api/admin.ts#L210) — listAdminUsers; appels : [src/features/admin/AdminUsersPage.tsx:90](../src/features/admin/AdminUsersPage.tsx#L90), [src/features/admin/dashboardData.ts:226](../src/features/admin/dashboardData.ts#L226) | F14 — Pagination parcourue mais limitée silencieusement à 50 pages (per_page=100). |
| `POST /api/admin/users` | Raccordé — aucun écart relevé | [src/api/admin.ts:231](../src/api/admin.ts#L231) — createAdminUser; appels : [src/features/admin/AdminUserWizardModal.tsx:80](../src/features/admin/AdminUserWizardModal.tsx#L80) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `GET /api/admin/users/{user}` | Adaptateur inutilisé | [src/api/admin.ts:220](../src/api/admin.ts#L220) — getAdminUser; appels : aucun | Fonction présente mais non appelée. Le détail est actuellement issu des listes ; décider si une relecture serveur est nécessaire. |
| `PUT /api/admin/users/{user}` | Raccordé — aucun écart relevé | [src/api/admin.ts:238](../src/api/admin.ts#L238) — updateAdminUser; appels : [src/api/admin.ts:249](../src/api/admin.ts#L249), [src/features/admin/AdminUsersPage.tsx:268](../src/features/admin/AdminUsersPage.tsx#L268) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `DELETE /api/admin/users/{user}` | Raccordé — aucun écart relevé | [src/api/admin.ts:245](../src/api/admin.ts#L245) — deactivateAdminUser; appels : [src/features/admin/AdminUsersPage.tsx:216](../src/features/admin/AdminUsersPage.tsx#L216) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `PUT /api/admin/users/{user}/password` | Raccordé — aucun écart relevé | [src/api/admin.ts:258](../src/api/admin.ts#L258) — resetAdminUserPassword; appels : [src/features/admin/AdminUsersPage.tsx:315](../src/features/admin/AdminUsersPage.tsx#L315) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `GET /api/admin/scoring-models` | Raccordé — aucun écart relevé | [src/api/admin.ts:265](../src/api/admin.ts#L265) — listScoringModels; appels : [src/features/admin/AdminScoringPage.tsx:54](../src/features/admin/AdminScoringPage.tsx#L54), [src/features/admin/dashboardData.ts:227](../src/features/admin/dashboardData.ts#L227) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `POST /api/admin/scoring-models` | Partiel / à corriger | [src/api/admin.ts:276](../src/api/admin.ts#L276) — createScoringModel; appels : [src/features/admin/AdminScoringPage.tsx:85](../src/features/admin/AdminScoringPage.tsx#L85) | F08 — COLD_START proposé par l’écran, alors que le schéma ScoringMode accepte seulement STANDARD. |
| `POST /api/admin/scoring-models/{scoringModel}/status` | Raccordé — aucun écart relevé | [src/api/admin.ts:283](../src/api/admin.ts#L283) — updateScoringModelStatus; appels : [src/features/admin/AdminScoringPage.tsx:138](../src/features/admin/AdminScoringPage.tsx#L138) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `POST /api/admin/scoring-models/{scoringModel}/rules` | Partiel / à corriger | [src/api/admin.ts:318](../src/api/admin.ts#L318) — createScoringRule; appels : [src/features/admin/AdminScoringPage.tsx:115](../src/features/admin/AdminScoringPage.tsx#L115) | F09 — activity_vitality absent du sélecteur ; min_score, max_score, rule_config, priority et status non exposés. Champs facultatifs : couverture partielle, pas une preuve de rejet serveur. |
| `GET /api/admin/audit-logs` | Partiel / à corriger | [src/api/admin.ts:290](../src/api/admin.ts#L290) — listAdminAuditLogs; appels : [src/features/admin/AdminAuditPage.tsx:51](../src/features/admin/AdminAuditPage.tsx#L51), [src/features/admin/dashboardData.ts:228](../src/features/admin/dashboardData.ts#L228) | F06 — Pagination non parcourue ; aussi appelé depuis les espaces analyste/comité malgré le rôle admin uniquement. |

### Analyste

| Méthode et endpoint | État | Implémentation / appelant | Vérification ou reste à faire |
|---|---|---|---|
| `GET /api/analyst/requests` | Partiel / à corriger | [src/api/credit.ts:241](../src/api/credit.ts#L241) — listAnalystRequests; appels : [src/api/credit.ts:712](../src/api/credit.ts#L712), [src/features/admin/dashboardData.ts:230](../src/features/admin/dashboardData.ts#L230) | F14 — Pagination parcourue mais limitée silencieusement à 20 pages (per_page=100). |
| `POST /api/analyst/requests/{creditRequest}/review` | Raccordé — aucun écart relevé | [src/api/credit.ts:762](../src/api/credit.ts#L762) — submitAnalystReview; appels : [src/app/legacy-runtime.ts:718](../src/app/legacy-runtime.ts#L718), [src/features/agent/fillAgentDrawers.ts:1834](../src/features/agent/fillAgentDrawers.ts#L1834) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `GET /api/analyst/requests/{creditRequest}/anomalies` | Raccordé — aucun écart relevé | [src/api/credit.ts:716](../src/api/credit.ts#L716) — listAnalystAnomalies; appels : [src/features/analyst/useAnalystWorkspace.ts:27](../src/features/analyst/useAnalystWorkspace.ts#L27) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `POST /api/analyst/anomalies/{anomaly}/resolve` | Raccordé — aucun écart relevé | [src/api/credit.ts:733](../src/api/credit.ts#L733) — resolveAnomaly; appels : [src/features/agent/fillAgentDrawers.ts:1945](../src/features/agent/fillAgentDrawers.ts#L1945) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `POST /api/analyst/requests/{creditRequest}/human-validation` | Raccordé — aucun écart relevé | [src/api/credit.ts:748](../src/api/credit.ts#L748) — submitHumanValidation; appels : [src/features/agent/fillAgentDrawers.ts:1585](../src/features/agent/fillAgentDrawers.ts#L1585), [src/features/agent/fillAgentDrawers.ts:1866](../src/features/agent/fillAgentDrawers.ts#L1866) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |

### Authentification client

| Méthode et endpoint | État | Implémentation / appelant | Vérification ou reste à faire |
|---|---|---|---|
| `POST /api/auth/register` | Raccordé — aucun écart relevé | [src/api/auth.ts:131](../src/api/auth.ts#L131) — registerClient; appels : [src/features/auth/AuthPage.tsx:178](../src/features/auth/AuthPage.tsx#L178) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `POST /api/auth/client/login` | Partiel / à corriger | [src/api/auth.ts:86](../src/api/auth.ts#L86) — loginWithCredentials; appels : [src/features/auth/AuthPage.tsx:121](../src/features/auth/AuthPage.tsx#L121) | F03 — Mot de passe modifié par trim(); les erreurs 422 sont reformulées comme identifiants incorrects. |

### Authentification interne

| Méthode et endpoint | État | Implémentation / appelant | Vérification ou reste à faire |
|---|---|---|---|
| `POST /api/auth/staff/login` | Partiel / à corriger | [src/api/auth.ts:85](../src/api/auth.ts#L85) — loginWithCredentials; appels : [src/features/auth/AuthPage.tsx:121](../src/features/auth/AuthPage.tsx#L121) | F03 — trim() du mot de passe ; toute erreur API est reformulée comme e-mail non reconnu, même un 429/500. |

### Session

| Méthode et endpoint | État | Implémentation / appelant | Vérification ou reste à faire |
|---|---|---|---|
| `POST /api/auth/logout` | Raccordé — aucun écart relevé | [src/api/auth.ts:164](../src/api/auth.ts#L164) — logoutFromApi; appels : [src/app/legacy-runtime.ts:579](../src/app/legacy-runtime.ts#L579), [src/shared/layout/AppShell.tsx:144](../src/shared/layout/AppShell.tsx#L144) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `GET /api/auth/me` | Raccordé — aucun écart relevé | [src/api/auth.ts:142](../src/api/auth.ts#L142) — fetchCurrentUser; appels : [src/features/client/BorrowerProfileForm.tsx:117](../src/features/client/BorrowerProfileForm.tsx#L117), [src/features/modals/EditProfileModal.tsx:116](../src/features/modals/EditProfileModal.tsx#L116) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `PUT /api/auth/password` | Raccordé — aucun écart relevé | [src/api/auth.ts:154](../src/api/auth.ts#L154) — updateOwnPassword; appels : [src/features/client/BorrowerProfileForm.tsx:205](../src/features/client/BorrowerProfileForm.tsx#L205), [src/features/modals/ChangePasswordModal.tsx:45](../src/features/modals/ChangePasswordModal.tsx#L45) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |

### Profil client

| Méthode et endpoint | État | Implémentation / appelant | Vérification ou reste à faire |
|---|---|---|---|
| `GET /api/profile` | Raccordé — aucun écart relevé | [src/api/profile.ts:107](../src/api/profile.ts#L107) — fetchClientProfile; appels : [src/api/savings.ts:50](../src/api/savings.ts#L50), [src/app/legacy-runtime.ts:307](../src/app/legacy-runtime.ts#L307) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `PUT /api/profile` | Partiel / à corriger | [src/api/profile.ts:227](../src/api/profile.ts#L227) — updateClientProfile; appels : [src/features/client/BorrowerProfileForm.tsx:215](../src/features/client/BorrowerProfileForm.tsx#L215), [src/features/client/persistFiche.ts:54](../src/features/client/persistFiche.ts#L54) | F07 — Champs société absents du payload typé et des écrans de modification ; contacts modifiés localement sans persistance par cette route. |
| `GET /api/profile/activities` | Raccordé — aucun écart relevé | [src/api/profile.ts:272](../src/api/profile.ts#L272) — listEconomicActivities; appels : [src/features/client/BorrowerProfileForm.tsx:134](../src/features/client/BorrowerProfileForm.tsx#L134), [src/features/client/persistFiche.ts:108](../src/features/client/persistFiche.ts#L108) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `POST /api/profile/activities` | Raccordé — aucun écart relevé | [src/api/profile.ts:289](../src/api/profile.ts#L289) — saveEconomicActivity; appels : [src/features/client/BorrowerProfileForm.tsx:223](../src/features/client/BorrowerProfileForm.tsx#L223), [src/features/client/persistFiche.ts:66](../src/features/client/persistFiche.ts#L66) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `GET /api/profile/financial-profile` | Raccordé — aucun écart relevé | [src/api/profile.ts:240](../src/api/profile.ts#L240) — fetchFinancialProfile; appels : [src/features/client/BorrowerProfileForm.tsx:133](../src/features/client/BorrowerProfileForm.tsx#L133), [src/features/client/persistFiche.ts:107](../src/features/client/persistFiche.ts#L107) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `PUT /api/profile/financial-profile` | Raccordé — aucun écart relevé | [src/api/profile.ts:256](../src/api/profile.ts#L256) — saveFinancialProfile; appels : [src/features/client/BorrowerProfileForm.tsx:239](../src/features/client/BorrowerProfileForm.tsx#L239), [src/features/client/persistFiche.ts:83](../src/features/client/persistFiche.ts#L83) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `POST /api/profile/financial-profile` | Raccordé — aucun écart relevé | [src/api/profile.ts:264](../src/api/profile.ts#L264) — saveFinancialProfile; appels : [src/features/client/BorrowerProfileForm.tsx:239](../src/features/client/BorrowerProfileForm.tsx#L239), [src/features/client/persistFiche.ts:83](../src/features/client/persistFiche.ts#L83) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `GET /api/profile/kyc-documents` | Raccordé — aucun écart relevé | [src/api/profile.ts:301](../src/api/profile.ts#L301) — listKycDocuments; appels : [src/features/client/ClientDocumentsPage.tsx:112](../src/features/client/ClientDocumentsPage.tsx#L112), [src/features/workflow/fillDocLightbox.ts:348](../src/features/workflow/fillDocLightbox.ts#L348) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `POST /api/profile/kyc-documents` | Raccordé — aucun écart relevé | [src/api/profile.ts:346](../src/api/profile.ts#L346) — uploadKycDocument; appels : [src/app/legacy-runtime.ts:514](../src/app/legacy-runtime.ts#L514) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `GET /api/profile/activities/{activity}` | Adaptateur inutilisé | [src/api/profile.ts:279](../src/api/profile.ts#L279) — getEconomicActivity; appels : aucun | Fonction présente mais non appelée. Le détail est actuellement issu des listes ; décider si une relecture serveur est nécessaire. |
| `PUT /api/profile/activities/{activity}` | Raccordé — aucun écart relevé | [src/api/profile.ts:285](../src/api/profile.ts#L285) — saveEconomicActivity; appels : [src/features/client/BorrowerProfileForm.tsx:223](../src/features/client/BorrowerProfileForm.tsx#L223), [src/features/client/persistFiche.ts:66](../src/features/client/persistFiche.ts#L66) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `DELETE /api/profile/activities/{activity}` | Raccordé — aucun écart relevé | [src/api/profile.ts:297](../src/api/profile.ts#L297) — deleteEconomicActivity; appels : [src/features/client/BorrowerProfileForm.tsx:91](../src/features/client/BorrowerProfileForm.tsx#L91) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `GET /api/profile/kyc-documents/{kycDocument}` | Raccordé — aucun écart relevé | [src/api/profile.ts:306](../src/api/profile.ts#L306) — getKycDocument; appels : [src/features/workflow/fillDocLightbox.ts:344](../src/features/workflow/fillDocLightbox.ts#L344) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `DELETE /api/profile/kyc-documents/{kycDocument}` | Raccordé — aucun écart relevé | [src/api/profile.ts:336](../src/api/profile.ts#L336) — deleteKycDocument; appels : [src/features/client/ClientDocumentsPage.tsx:95](../src/features/client/ClientDocumentsPage.tsx#L95) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |

### Comité

| Méthode et endpoint | État | Implémentation / appelant | Vérification ou reste à faire |
|---|---|---|---|
| `GET /api/committee/requests` | Partiel / à corriger | [src/api/credit.ts:245](../src/api/credit.ts#L245) — listCommitteeRequests; appels : [src/features/admin/dashboardData.ts:231](../src/features/admin/dashboardData.ts#L231), [src/features/committee/fillCommittee.ts:268](../src/features/committee/fillCommittee.ts#L268) | F14 — Pagination parcourue mais limitée silencieusement à 20 pages (per_page=100). |
| `POST /api/committee/requests/{creditRequest}/decide` | Raccordé — aucun écart relevé | [src/api/credit.ts:780](../src/api/credit.ts#L780) — submitCommitteeDecision; appels : [src/features/committee/fillCommittee.ts:528](../src/features/committee/fillCommittee.ts#L528) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |

### Chargé de crédit

| Méthode et endpoint | État | Implémentation / appelant | Vérification ou reste à faire |
|---|---|---|---|
| `GET /api/agent/requests` | Partiel / à corriger | [src/api/credit.ts:237](../src/api/credit.ts#L237) — listAgentRequests; appels : [src/features/admin/dashboardData.ts:229](../src/features/admin/dashboardData.ts#L229), [src/features/agent/fillAgentDrawers.ts:1060](../src/features/agent/fillAgentDrawers.ts#L1060) | F14 — Pagination parcourue mais limitée silencieusement à 20 pages (per_page=100). |
| `POST /api/agent/requests/{creditRequest}/request-complements` | Raccordé — aucun écart relevé | [src/api/credit.ts:522](../src/api/credit.ts#L522) — requestComplements; appels : [src/features/agent/fillAgentDrawers.ts:1347](../src/features/agent/fillAgentDrawers.ts#L1347), [src/features/agent/fillAgentDrawers.ts:1549](../src/features/agent/fillAgentDrawers.ts#L1549) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `POST /api/agent/requests/{creditRequest}/send-to-analysis` | Raccordé — aucun écart relevé | [src/api/credit.ts:276](../src/api/credit.ts#L276) — sendRequestToAnalysis; appels : [src/app/legacy-runtime.ts:681](../src/app/legacy-runtime.ts#L681), [src/features/workflow/CreditWorkflowBoard.tsx:66](../src/features/workflow/CreditWorkflowBoard.tsx#L66) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `POST /api/agent/clients/{client}/kyc-documents/{kycDocument}/verify` | Raccordé — aucun écart relevé | [src/api/agent.ts:179](../src/api/agent.ts#L179) — verifyKycDocument; appels : [src/features/agent/fillAgentDrawers.ts:1317](../src/features/agent/fillAgentDrawers.ts#L1317), [src/features/agent/fillAgentDrawers.ts:1572](../src/features/agent/fillAgentDrawers.ts#L1572) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `POST /api/agent/guarantees/{guarantee}/verify` | Raccordé — aucun écart relevé | [src/api/credit.ts:533](../src/api/credit.ts#L533) — verifyGuarantee; appels : [src/features/agent/fillAgentDrawers.ts:1451](../src/features/agent/fillAgentDrawers.ts#L1451) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `POST /api/agent/clients/{client}/financial-accounts` | Partiel / à corriger | [src/api/agent.ts:137](../src/api/agent.ts#L137) — storeClientFinancialAccount; appels : [src/features/agent/AgentClientSheet.tsx:145](../src/features/agent/AgentClientSheet.tsx#L145) | F11 — Envoi PENDING raccordé ; activation dépend des nouvelles routes admin non documentées. Validation serveur de PENDING à confirmer. |
| `POST /api/agent/financial-accounts/{financialAccount}/transactions` | Raccordé — aucun écart relevé | [src/api/agent.ts:144](../src/api/agent.ts#L144) — storeAccountTransaction; appels : [src/features/agent/AgentClientSheet.tsx:177](../src/features/agent/AgentClientSheet.tsx#L177) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `POST /api/agent/clients/{client}/savings-history` | Raccordé — aucun écart relevé | [src/api/agent.ts:151](../src/api/agent.ts#L151) — storeClientSavingsHistory; appels : [src/features/agent/AgentClientSheet.tsx:209](../src/features/agent/AgentClientSheet.tsx#L209) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `GET /api/agent/clients` | Partiel / à corriger | [src/api/agent.ts:98](../src/api/agent.ts#L98) — listAgentClients; appels : [src/features/admin/AdminUsersPage.tsx:118](../src/features/admin/AdminUsersPage.tsx#L118), [src/features/agent/AgentLoansPage.tsx:59](../src/features/agent/AgentLoansPage.tsx#L59) | F14 — Pagination parcourue mais limitée silencieusement à 20 pages (per_page=100). |
| `GET /api/agent/clients/{client}` | Raccordé — aucun écart relevé | [src/api/agent.ts:128](../src/api/agent.ts#L128) — getAgentClient; appels : [src/features/agent/AgentClientSheet.tsx:80](../src/features/agent/AgentClientSheet.tsx#L80), [src/features/agent/fillAgentDrawers.ts:1071](../src/features/agent/fillAgentDrawers.ts#L1071) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `GET /api/agent/clients/{client}/kyc` | Partiel / à corriger | [src/api/agent.ts:159](../src/api/agent.ts#L159) — listAgentClientKycDocuments; appels : [src/features/agent/fillAgentDrawers.ts:1024](../src/features/agent/fillAgentDrawers.ts#L1024), [src/features/agent/fillAgentDrawers.ts:1131](../src/features/agent/fillAgentDrawers.ts#L1131) | F05 — Toute erreur réseau/API est convertie en liste vide, indistinguable de l’absence de pièces. |

### Produits de crédit

| Méthode et endpoint | État | Implémentation / appelant | Vérification ou reste à faire |
|---|---|---|---|
| `GET /api/credit-products` | Partiel / à corriger | [src/api/credit.ts:688](../src/api/credit.ts#L688) — listCreditProducts; appels : [src/features/modals/LoanApplicationModal.tsx:25](../src/features/modals/LoanApplicationModal.tsx#L25) | F10 — En cas d’erreur ou de catalogue vide, le formulaire affiche tout le catalogue statique, sans filtrage personne physique/morale. |

### Demandes de crédit

| Méthode et endpoint | État | Implémentation / appelant | Vérification ou reste à faire |
|---|---|---|---|
| `GET /api/credit-requests` | Partiel / à corriger | [src/api/credit.ts:233](../src/api/credit.ts#L233) — listMyCreditRequests; appels : [src/app/legacy-runtime.ts:523](../src/app/legacy-runtime.ts#L523), [src/features/client/ClientDocumentsPage.tsx:112](../src/features/client/ClientDocumentsPage.tsx#L112) | F14 — Pagination parcourue mais limitée silencieusement à 20 pages (per_page=100). |
| `POST /api/credit-requests` | Partiel / à corriger | [src/api/credit.ts:250](../src/api/credit.ts#L250) — createCreditRequest; appels : [src/features/client/submitLoan.ts:120](../src/features/client/submitLoan.ts#L120) | F02 — Route client seulement mais bouton de création également présent côté agent ; le précontrôle utilise /profile (client seulement). |
| `GET /api/credit-requests/{creditRequest}` | Raccordé — aucun écart relevé | [src/api/credit.ts:357](../src/api/credit.ts#L357) — getCreditRequest; appels : [src/features/agent/fillAgentDrawers.ts:1058](../src/features/agent/fillAgentDrawers.ts#L1058), [src/features/client/submitLoan.ts:215](../src/features/client/submitLoan.ts#L215) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `PUT /api/credit-requests/{creditRequest}` | Raccordé — aucun écart relevé | [src/api/credit.ts:258](../src/api/credit.ts#L258) — updateCreditRequest; appels : [src/features/client/submitLoan.ts:108](../src/features/client/submitLoan.ts#L108) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `DELETE /api/credit-requests/{creditRequest}` | Raccordé — aucun écart relevé | [src/api/credit.ts:266](../src/api/credit.ts#L266) — deleteCreditRequest; appels : [src/app/legacy-runtime.ts:656](../src/app/legacy-runtime.ts#L656) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `GET /api/credit-requests/{creditRequest}/guarantees` | Raccordé — aucun écart relevé | [src/api/credit.ts:362](../src/api/credit.ts#L362) — listCreditRequestGuarantees; appels : [src/api/credit.ts:471](../src/api/credit.ts#L471), [src/features/agent/fillAgentDrawers.ts:1022](../src/features/agent/fillAgentDrawers.ts#L1022) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `POST /api/credit-requests/{creditRequest}/guarantees` | Raccordé — aucun écart relevé | [src/api/credit.ts:419](../src/api/credit.ts#L419) — addCreditGuarantee; appels : [src/features/client/fillClientRequestDrawer.ts:369](../src/features/client/fillClientRequestDrawer.ts#L369), [src/features/client/submitLoan.ts:93](../src/features/client/submitLoan.ts#L93) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `POST /api/credit-requests/{creditRequest}/submit` | Partiel / à corriger | [src/api/credit.ts:271](../src/api/credit.ts#L271) — submitCreditRequest; appels : [src/app/legacy-runtime.ts:533](../src/app/legacy-runtime.ts#L533), [src/features/client/submitLoan.ts:199](../src/features/client/submitLoan.ts#L199) | F02 — Précontrôle /profile imposé à tous les appelants ; incompatible avec les rôles chargé/admin autorisés par cette route. Parcours client raccordé. |
| `GET /api/credit-requests/{creditRequest}/documents` | Raccordé — aucun écart relevé | [src/api/credit.ts:352](../src/api/credit.ts#L352) — listCreditRequestDocuments; appels : [src/api/credit.ts:470](../src/api/credit.ts#L470), [src/api/credit.ts:501](../src/api/credit.ts#L501) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `POST /api/credit-requests/{creditRequest}/documents` | Raccordé — aucun écart relevé | [src/api/credit.ts:462](../src/api/credit.ts#L462) — uploadCreditDocument; appels : [src/app/legacy-runtime.ts:530](../src/app/legacy-runtime.ts#L530), [src/features/client/submitLoan.ts:148](../src/features/client/submitLoan.ts#L148) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `GET /api/credit-requests/{creditRequest}/documents/{document}` | Raccordé — aucun écart relevé | [src/api/credit.ts:329](../src/api/credit.ts#L329) — getCreditDocument; appels : [src/api/credit.ts:337](../src/api/credit.ts#L337), [src/features/workflow/fillDocLightbox.ts:323](../src/features/workflow/fillDocLightbox.ts#L323) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `DELETE /api/credit-requests/{creditRequest}/documents/{document}` | Raccordé — aucun écart relevé | [src/api/credit.ts:450](../src/api/credit.ts#L450) — deleteCreditDocument; appels : [src/features/client/ClientDocumentsPage.tsx:97](../src/features/client/ClientDocumentsPage.tsx#L97), [src/features/client/fillClientRequestDrawer.ts:189](../src/features/client/fillClientRequestDrawer.ts#L189) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `GET /api/credit-requests/{creditRequest}/guarantees/{guarantee}` | Raccordé — aucun écart relevé | [src/api/credit.ts:367](../src/api/credit.ts#L367) — getCreditGuarantee; appels : [src/features/agent/fillAgentDrawers.ts:1379](../src/features/agent/fillAgentDrawers.ts#L1379), [src/features/workflow/fillDocLightbox.ts:299](../src/features/workflow/fillDocLightbox.ts#L299) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `PUT /api/credit-requests/{creditRequest}/guarantees/{guarantee}` | Partiel / à corriger | [src/api/credit.ts:433](../src/api/credit.ts#L433) — updateCreditGuarantee; appels : [src/features/client/fillClientRequestDrawer.ts:339](../src/features/client/fillClientRequestDrawer.ts#L339), [src/features/client/submitLoan.ts:90](../src/features/client/submitLoan.ts#L90) | F13 — JSON PUT présent ; remplacement fichier via POST + _method=PUT. Convention à vérifier sur serveur, non explicitée par Swagger. |
| `DELETE /api/credit-requests/{creditRequest}/guarantees/{guarantee}` | Raccordé — aucun écart relevé | [src/api/credit.ts:446](../src/api/credit.ts#L446) — deleteCreditGuarantee; appels : [src/features/client/fillClientRequestDrawer.ts:307](../src/features/client/fillClientRequestDrawer.ts#L307) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `GET /api/guarantees/{guarantee}/file` | Raccordé — aucun écart relevé | [src/api/credit.ts:372](../src/api/credit.ts#L372) — fetchGuaranteeFile; appels : [src/features/workflow/fillDocLightbox.ts:314](../src/features/workflow/fillDocLightbox.ts#L314) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |

### Documents

| Méthode et endpoint | État | Implémentation / appelant | Vérification ou reste à faire |
|---|---|---|---|
| `GET /api/documents/{document}/file` | Raccordé — aucun écart relevé | [src/api/credit.ts:348](../src/api/credit.ts#L348) — fetchCreditDocumentFile; appels : [src/features/workflow/fillDocLightbox.ts:329](../src/features/workflow/fillDocLightbox.ts#L329) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `GET /api/kyc-documents/{kycDocument}/file` | Raccordé — aucun écart relevé | [src/api/profile.ts:143](../src/api/profile.ts#L143) — fetchKycDocumentFile; appels : [src/features/workflow/fillDocLightbox.ts:356](../src/features/workflow/fillDocLightbox.ts#L356) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |

### Visites terrain

| Méthode et endpoint | État | Implémentation / appelant | Vérification ou reste à faire |
|---|---|---|---|
| `GET /api/agent/field-visits` | Absent du frontend | — | F01 — À implémenter côté frontend. |
| `GET /api/agent/requests/{creditRequest}/field-visits` | Absent du frontend | — | F01 — À implémenter côté frontend. |
| `POST /api/agent/requests/{creditRequest}/field-visits` | Absent du frontend | — | F01 — À implémenter côté frontend. |
| `GET /api/agent/field-visits/{fieldVisit}` | Absent du frontend | — | F01 — À implémenter côté frontend. |
| `PUT /api/agent/field-visits/{fieldVisit}` | Absent du frontend | — | F01 — À implémenter côté frontend. |
| `POST /api/agent/field-visits/{fieldVisit}/start` | Absent du frontend | — | F01 — À implémenter côté frontend. |
| `POST /api/agent/field-visits/{fieldVisit}/complete` | Absent du frontend | — | F01 — À implémenter côté frontend. |
| `POST /api/agent/field-visits/{fieldVisit}/cancel` | Absent du frontend | — | F01 — À implémenter côté frontend. |

### Prêts

| Méthode et endpoint | État | Implémentation / appelant | Vérification ou reste à faire |
|---|---|---|---|
| `GET /api/loans` | Partiel / à corriger | [src/api/loans.ts:63](../src/api/loans.ts#L63) — listMyLoans; appels : [src/features/agent/AgentLoansPage.tsx:58](../src/features/agent/AgentLoansPage.tsx#L58), [src/features/committee/useCommitteeWorkspace.ts:21](../src/features/committee/useCommitteeWorkspace.ts#L21) | F14 — Pagination parcourue mais limitée silencieusement à 20 pages (per_page=100). |
| `GET /api/loans/{loan}` | Raccordé — aucun écart relevé | [src/api/loans.ts:107](../src/api/loans.ts#L107) — getLoan; appels : [src/features/agent/AgentLoansPage.tsx:106](../src/features/agent/AgentLoansPage.tsx#L106), [src/features/loans/granted.ts:116](../src/features/loans/granted.ts#L116) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `GET /api/loans/{loan}/repayments` | Raccordé — aucun écart relevé | [src/api/loans.ts:78](../src/api/loans.ts#L78) — listLoanRepayments; appels : [src/features/agent/AgentLoansPage.tsx:107](../src/features/agent/AgentLoansPage.tsx#L107), [src/features/loans/granted.ts:118](../src/features/loans/granted.ts#L118) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `POST /api/loans/{loan}/disburse` | Raccordé — aucun écart relevé | [src/api/loans.ts:112](../src/api/loans.ts#L112) — disburseLoan; appels : [src/features/agent/AgentLoansPage.tsx:128](../src/features/agent/AgentLoansPage.tsx#L128) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `POST /api/loans/{loan}/repayments/{repayment}/record` | Raccordé — aucun écart relevé | [src/api/loans.ts:124](../src/api/loans.ts#L124) — recordLoanRepayment; appels : [src/features/agent/AgentLoansPage.tsx:154](../src/features/agent/AgentLoansPage.tsx#L154), [src/features/loans/postOctroi.ts:193](../src/features/loans/postOctroi.ts#L193) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |

### Notifications

| Méthode et endpoint | État | Implémentation / appelant | Vérification ou reste à faire |
|---|---|---|---|
| `GET /api/notifications` | Partiel / à corriger | [src/api/notifications.ts:31](../src/api/notifications.ts#L31) — listNotifications; appels : [src/features/agent/fillAgentDrawers.ts:1478](../src/features/agent/fillAgentDrawers.ts#L1478), [src/features/workflow/NotificationBell.tsx:57](../src/features/workflow/NotificationBell.tsx#L57) | F12 — Première page seulement et 12 éléments affichés ; absence de navigation vers les plus anciens. Type FIELD_VISIT sans libellé/lien spécialisé. |
| `POST /api/notifications/{notification}/read` | Raccordé — aucun écart relevé | [src/api/notifications.ts:56](../src/api/notifications.ts#L56) — markNotificationRead; appels : [src/features/workflow/NotificationBell.tsx:102](../src/features/workflow/NotificationBell.tsx#L102) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `GET /api/notifications/{notification}` | Raccordé — aucun écart relevé | [src/api/notifications.ts:41](../src/api/notifications.ts#L41) — getNotification; appels : [src/features/workflow/NotificationBell.tsx:105](../src/features/workflow/NotificationBell.tsx#L105) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `DELETE /api/notifications/{notification}` | Raccordé — aucun écart relevé | [src/api/notifications.ts:60](../src/api/notifications.ts#L60) — deleteNotification; appels : [src/features/workflow/NotificationBell.tsx:116](../src/features/workflow/NotificationBell.tsx#L116) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |

### Photo de profil

| Méthode et endpoint | État | Implémentation / appelant | Vérification ou reste à faire |
|---|---|---|---|
| `GET /api/profile-photo` | Raccordé — aucun écart relevé | [src/api/profile.ts:353](../src/api/profile.ts#L353) — fetchProfilePhotoMeta; appels : [src/features/client/BorrowerProfileForm.tsx:162](../src/features/client/BorrowerProfileForm.tsx#L162), [src/features/modals/EditProfileModal.tsx:194](../src/features/modals/EditProfileModal.tsx#L194) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `PUT /api/profile-photo` | Raccordé — aucun écart relevé | [src/api/profile.ts:376](../src/api/profile.ts#L376) — uploadProfilePhoto; appels : [src/features/client/BorrowerProfileForm.tsx:194](../src/features/client/BorrowerProfileForm.tsx#L194), [src/features/modals/EditProfileModal.tsx:223](../src/features/modals/EditProfileModal.tsx#L223) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `POST /api/profile-photo` | Raccordé — aucun écart relevé | [src/api/profile.ts:376](../src/api/profile.ts#L376) — uploadProfilePhoto; appels : [src/features/client/BorrowerProfileForm.tsx:194](../src/features/client/BorrowerProfileForm.tsx#L194), [src/features/modals/EditProfileModal.tsx:223](../src/features/modals/EditProfileModal.tsx#L223) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `DELETE /api/profile-photo` | Raccordé — aucun écart relevé | [src/api/profile.ts:369](../src/api/profile.ts#L369) — deleteProfilePhoto; appels : [src/features/client/BorrowerProfileForm.tsx:69](../src/features/client/BorrowerProfileForm.tsx#L69), [src/features/modals/EditProfileModal.tsx:84](../src/features/modals/EditProfileModal.tsx#L84) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |
| `GET /api/users/{user}/photo/file` | Raccordé — aucun écart relevé | [src/api/profile.ts:365](../src/api/profile.ts#L365) — fetchUserPhotoFile; appels : [src/features/client/BorrowerProfileForm.tsx:165](../src/features/client/BorrowerProfileForm.tsx#L165), [src/features/modals/EditProfileModal.tsx:200](../src/features/modals/EditProfileModal.tsx#L200) | Méthode/chemin et raccordement repérés ; aucun écart spécifique relevé dans cet audit. Recette authentifiée à effectuer. |

### Scoring et analyse

| Méthode et endpoint | État | Implémentation / appelant | Vérification ou reste à faire |
|---|---|---|---|
| `POST /api/credit-requests/{creditRequest}/score` | Partiel / à corriger | [src/api/credit.ts:562](../src/api/credit.ts#L562) — evaluateCreditScore; appels : [src/api/credit.ts:575](../src/api/credit.ts#L575) | F04 — Fallback aussi utilisé par le comité, qui ne figure pas parmi les rôles autorisés au calcul. |
| `GET /api/credit-requests/{creditRequest}/analysis` | Partiel / à corriger | [src/api/credit.ts:557](../src/api/credit.ts#L557) — getCreditAnalysis; appels : [src/api/credit.ts:568](../src/api/credit.ts#L568), [src/features/client/fillClientRequestDrawer.ts:452](../src/features/client/fillClientRequestDrawer.ts#L452) | F04 — Le helper de lecture déclenche POST /score sur toute erreur, pas seulement une analyse absente. |

### Simulation

| Méthode et endpoint | État | Implémentation / appelant | Vérification ou reste à faire |
|---|---|---|---|
| `POST /api/simulations/installments` | Partiel / à corriger | [src/api/simulations.ts:75](../src/api/simulations.ts#L75) — simulateInstallments; appels : [src/features/client/runSimulation.ts:150](../src/features/client/runSimulation.ts#L150), [src/features/client/runSimulation.ts:258](../src/features/client/runSimulation.ts#L258) | F09 — Scénarios/revenus/charges/dette raccordés ; other_income documenté mais absent du type d’entrée frontend. |

## Routes frontend non présentes dans le Swagger actuel

Ne pas les confondre avec des endpoints existants non implémentés : il s’agit du contrat épargne préparé pour le binôme backend. Voir [savings-api.md](savings-api.md).

| Appel | Source | État |
|---|---|---|
| `GET /api/profile/savings-membership` | [src/api/savings.ts:21](../src/api/savings.ts#L21) | Non documenté ; intégration réelle à confirmer |
| `POST /api/profile/savings-membership` | [src/api/savings.ts:30](../src/api/savings.ts#L30) | Non documenté ; intégration réelle à confirmer |
| `POST /api/profile/savings-membership/{}/resubmit` | [src/api/savings.ts:30](../src/api/savings.ts#L30) | Non documenté ; intégration réelle à confirmer |
| `GET /api/admin/savings-memberships` | [src/api/savings.ts:38](../src/api/savings.ts#L38) | Non documenté ; intégration réelle à confirmer |
| `POST /api/admin/savings-memberships/{}/review` | [src/api/savings.ts:42](../src/api/savings.ts#L42) | Non documenté ; intégration réelle à confirmer |
| `GET /api/admin/savings-memberships/{}/documents/{}/file` | [src/api/savings.ts:46](../src/api/savings.ts#L46) | Non documenté ; intégration réelle à confirmer |
| `GET /api/admin/financial-accounts` | [src/features/admin/AdminSavingsPage.tsx:16](../src/features/admin/AdminSavingsPage.tsx#L16) | Non documenté ; intégration réelle à confirmer |
| `POST /api/admin/financial-accounts/{}/review` | [src/features/admin/AdminSavingsPage.tsx:29](../src/features/admin/AdminSavingsPage.tsx#L29) | Non documenté ; intégration réelle à confirmer |

## Vérifications exécutées et recette restante

- Inventaire TypeScript AST : 93 opérations rapprochées par méthode/chemin ; inspection manuelle des formulaires, rôles, payloads et erreurs pour les écarts listés.
- scripts/test-api-audit.mjs : 10 contrôles hors réseau, dont 7 vérifications d’adaptateurs et 3 reproductions d’anomalies (F03, F04, F05). Le succès des tests de caractérisation signifie que les anomalies sont reproduites, pas corrigées.
- Aucun appel de mutation au serveur, aucun test avec identifiants réels. Les routes protégées, la persistance des fichiers, le multipart PUT, les droits par rôle et les transitions restent à tester en environnement de recette.

À tester avec client PP, client PM, chargé, analyste, comité et admin : création/reprise de dossier, documents et garanties, KYC, transmission, analyse, décision, décaissement et remboursement ; 401/403/404/409/422/429/500, perte réseau, pagination et double soumission.

Reproduction : node scripts/audit-api.mjs [chemin-du-schema.json], puis node scripts/test-api-audit.mjs. Le script d’inventaire conserve des annotations de revue manuelle : les revalider après toute correction du code.
