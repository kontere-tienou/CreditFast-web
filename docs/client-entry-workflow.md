# Accès CreditFast et compte bancaire

## Phase actuelle : validation locale du frontend

Le backend est débranché par défaut. `src/app/runtimeMode.ts` active le mode local tant que `VITE_BACKEND_ENABLED` ne vaut pas explicitement `true`. La présence de `VITE_API_URL` ne suffit pas à activer une connexion. Ne réactiver le backend qu’après validation des processus.

Le transport `src/api/client.ts` dirige les opérations vers `src/api/localWorkflow.ts`, sans repli réseau. Les écrans et formulaires existants restent les supports de validation du futur backend.

Sur la page de connexion, choisir un scénario dans « Atelier des parcours », puis se connecter :

| Scénario | Accès fictif | Situation initiale |
| --- | --- | --- |
| Client avec épargne | +22370000001 | Épargne active à Hamdallaye, identité présente |
| Client sans épargne | +22370000002 | Ouverture épargne nécessaire |
| Profil à compléter | +22370000003 | Épargne active à Hamdallaye, identité manquante |
| Client Ségou | +22370000004 | Compte et zone déjà à Ségou Centre, identité présente |
| Agent | agent@demo.creditfast | Équipe de Hamdallaye |
| Analyste | analyst@demo.creditfast | Équipe de Hamdallaye |
| Comité | committee@demo.creditfast | Équipe de Hamdallaye |
| Administrateur | admin@demo.creditfast | Supervision des agences et file d’affectation |
| Agent Ségou | agent.segou@demo.creditfast | Équipe de Ségou Centre |
| Analyste Ségou | analyst.segou@demo.creditfast | Équipe de Ségou Centre |
| Comité Ségou | committee.segou@demo.creditfast | Équipe de Ségou Centre |
| Agent Kalabancoura | agent.kalabancoura@demo.creditfast | Équipe de Kalabancoura |
| Analyste Kalabancoura | analyst.kalabancoura@demo.creditfast | Équipe de Kalabancoura |
| Comité Kalabancoura | committee.kalabancoura@demo.creditfast | Équipe de Kalabancoura |
| Agent Faladié | agent.faladie@demo.creditfast | Équipe de Faladié |
| Analyste Faladié | analyst.faladie@demo.creditfast | Équipe de Faladié |
| Comité Faladié | committee.faladie@demo.creditfast | Équipe de Faladié |

Les mots de passe de démonstration ne sont pas vérifiés ni conservés. L’inscription crée un nouveau profil local sans compte épargne ni pièce. Ces comptes ne permettent aucune connexion bancaire réelle. Les anciennes sessions backend sont ignorées, et les sessions locales sont ignorées lorsque le backend est activé.

Les données sont conservées dans `localStorage` sous `creditfast:local-workflow:v1`, les fichiers déposés dans IndexedDB `creditfast-local-files`. Les rôles partagent les dossiers de ce navigateur afin de tester les transmissions ; les clients voient leurs propres dossiers. Les données ne sont pas partagées entre navigateurs ou ordinateurs. Utiliser uniquement des informations fictives.

Parcours disponibles : connexion/inscription, profil, pièces d’identité, ouverture épargne et décision de l’équipe, création du prêt et pièces/garanties, visites terrain, transmission agent → analyste → comité, décision, versement sur le compte épargne et échéancier. Le taux appliqué au score, à la simulation et à l’échéancier est de 15 % par an.

Les fonctions annexes encore non définies (par exemple gestion des utilisateurs, paramétrage des règles, photo et changement du mot de passe) retournent un message « Étape locale à définir ». Elles ne réussissent pas artificiellement et ne contactent jamais le backend. Les notifications et journaux ne sont pas encore simulés. Le prototype et ses transitions restent à valider fonctionnellement avant d’en déduire les règles définitives du serveur.

Vérification automatisée : `node scripts/test-local-workflow.mjs`, `node scripts/test-savings.mjs`, puis `npm.cmd run build` sous Windows.

## Parcours client

La vue épargne reprend la disposition des références visuelles : indicateurs verticaux, courbe de solde, synthèse des mouvements et colonne latérale de statistiques ; les transactions occupent ensuite toute la largeur. Les graphiques utilisent les opérations comptabilisées de l’année et du mois choisis. Les soldes affichés dans les indicateurs restent les soldes actuels. La courbe utilise uniquement les soldes `balance_after` disponibles ; aucune projection ni croissance fictive n’est ajoutée. Les informations du compte restent accessibles dans un volet dépliable sous le tableau.

Le tableau propose sélection par ligne/page, filtres repliables, pagination (5/10/20 lignes), export CSV des lignes filtrées ou sélectionnées et export individuel. L’export est local et neutralise les cellules susceptibles d’être interprétées comme formules. Le détail reste consultable dans un panneau latéral ; aucune action de modification/suppression d’un mouvement bancaire n’est introduite.

L’historique épargne utilise `GET /profile/financial-accounts/{id}/transactions` dans le transport local. Chaque opération expose référence, date ISO, libellé, type, sens CREDIT/DEBIT, montant positif en FCFA, statut, canal et solde après comptabilisation. Les opérations en attente ou annulées ne participent pas au solde. Recherche par référence/libellé/type, dates inclusives, filtre de type et détail latéral sont disponibles. Les deux comptes initiaux à 500 000 FCFA reçoivent un historique cohérent conservé dans le navigateur ; les nouveaux comptes commencent sans opération. Le transport interdit la lecture du compte d’un autre client. Ce contrat reste à valider avant intégration bancaire.

La page épargne présente le résumé financier par compte : `balance` (solde total), `available_balance` (montant disponible) et `blocked_balance` (montant immobilisé), en FCFA. Une valeur absente reste affichée « — » dans l’interface. Le fournisseur local considère les anciens comptes sans blocage renseigné comme non bloqués et calcule leur disponibilité par différence ; il conserve les comptes et dossiers déjà enregistrés. Le futur backend devra fournir ces montants selon les règles bancaires validées.

Le compte de connexion CreditFast est distinct du client bancaire et de son compte épargne.

À chaque ouverture de l’espace authentifié, le frontend interroge `/profile/savings-onboarding`, puis lit `/profile` lorsque le compte est actif :

1. Aucun compte épargne : accueil personnalisé proposant une pré-demande ou une visite en agence. Une demande déjà déposée oriente vers son suivi sans rouvrir le formulaire. Un compte inactif oriente vers l’agence, sans proposer une nouvelle ouverture.
2. Compte épargne actif : contrôle des pièces du profil via `/profile/kyc-documents`.
3. Pièce d’identité manquante, rejetée ou expirée : orientation vers les documents. Une CNI, NINA ou un passeport est requis. Un dépôt en attente de contrôle permet de préparer une demande ; il ne vaut pas validation KYC.
4. Compte épargne actif et pièce présente : navigation libre dans l’espace client. Le formulaire de prêt s’ouvre uniquement sur une action explicite (« Faire une demande de prêt », reprise de brouillon ou parcours du simulateur). Les règles de soumission et de validation du dossier restent applicables. Le revenu mensuel, les dépenses et le nombre de crédits en cours ne se saisissent pas : `GET /profile/account-check` reprend le revenu et les dépenses du profil financier, et compte les prêts actifs ou accordés (`ongoing_credit_count`). La création et la modification d’un dossier recopient ces valeurs ; un montant de mensualité envoyé par le formulaire est ignoré. Le score, lui, déduit encore les échéances réelles de ces prêts. Un prêt accordé crédite le capital sur le compte épargne, opération de type `LOAN_DISBURSEMENT`, sens CREDIT, libellée « Épargne + ».

Cette vérification d’entrée ne se relance pas lors des changements de page. La navigation ne doit jamais ouvrir automatiquement le formulaire de prêt.

L’accueil est présenté une seule fois par session. La page épargne permet de reprendre le parcours après fermeture. La pré-demande demande uniquement le nom complet (ou la raison sociale), le téléphone, la ville et l’agence choisie ; le numéro de compte est facultatif pour un client déclarant un compte existant. `POST /profile/savings-pre-applications` conserve une référence et une demande en attente, sans créer ni activer de compte. Une demande en cours ne peut pas être dupliquée ; une demande à corriger peut être complétée.

Le rapprochement local exige une identité déjà vérifiée, comparée par type de pièce, pays, autorité émettrice et numéro. Le nom et le téléphone ne déclenchent jamais un rattachement. Le numéro de compte, le réseau et le code agence servent à confirmer un compte précis. Une correspondance unique permet de conserver le lien stable `bank_client_id` ; une identité non vérifiée, plusieurs correspondances ou un lien déjà utilisé par un autre profil imposent un contrôle en agence. Une recherche indisponible n’est pas assimilée à une absence de compte.

L’agent ou l’administrateur contrôle les originaux en agence via l’action locale `verify-identity`. Il rattache le compte existant lorsque la correspondance est confirmée ; sinon, il prépare l’ouverture. L’activation exige une confirmation du passage en agence, un numéro de compte et la signature de la caisse. L’annuaire Bamako / Ségou et les identités de départ sont fictifs et servent uniquement à valider ce parcours. Une nouvelle inscription sans identité bancaire vérifiée passe par ce contrôle avant toute ouverture.

Les erreurs de lecture bloquent la vérification avec possibilité de réessayer. Un compte bancaire existant ne nécessite pas une nouvelle adhésion ni la disponibilité du catalogue des caisses.

## Affectation des dossiers par agence et zone

L’affectation et le cloisonnement des dossiers sont implémentés dans le transport local. Le backend reste débranché et reprendra ensuite ces règles côté serveur. La validation visuelle du parcours reste à effectuer.

« Mes demandes » affiche quatre compteurs : toutes les demandes, brouillons, dossiers en cours (agent, analyste ou comité) et demandes accordées par le comité. Un dossier dont l’agent ou l’analyste a demandé un complément reste compté à part et s’affiche en priorité, avant les autres dossiers en cours. Cette page ne contient plus le formulaire de zone, de compte ni le nom de l’agent. La zone se choisit dans les écrans de profil, limitée aux zones de l’agence du compte épargne. Avec un seul compte épargne actif, ce compte est utilisé automatiquement à la soumission. Si plusieurs comptes sont éligibles, le compte utilisé doit rester explicite côté serveur.

Le tableau de bord administrateur contient « Affectation des dossiers » : filtre par agence, dossiers à affecter, réaffectation avec motif, historique, couverture et disponibilité des agents. Dans cette version, l’administrateur assure explicitement la supervision interagences ; un rôle distinct de responsable d’agence n’est pas encore introduit. Les réaffectations proposées restent internes à l’agence et concernent les dossiers encore dans le circuit agent. Un transfert interagences nécessite encore un parcours dédié.

Chaque agence du référentiel a son équipe : un agent, un analyste et un membre du comité. Hamdallaye utilise les comptes agent, analyste et comité initiaux. Ségou Centre, Kalabancoura et Faladié ont les comptes listés dans l’atelier de connexion. Le client `+22370000004` est déjà rattaché à Ségou Centre, avec un compte épargne et la zone `SEG`. Le référentiel comporte les zones Hamdallaye (`HAM`, agence `BKO-HAM`), Kalabancoura (`KAL`, `BKO-KAL`), Faladié (`FAL`, `BKO-FAL`) et Ségou Centre (`SEG`, `SEG-CEN`). Les dossiers antérieurs à cette évolution passent dans la file d’affectation pour confirmation, sans attribution arbitraire à un agent.

Contrats locaux ajoutés : `GET /routing/catalog`, `GET /routing/requests` (administrateur), `PUT /routing/agents/{id}` (couverture et disponibilité), `POST /routing/requests/{id}/assign` (affectation avec motif). Les contrôles des dossiers s’appliquent aussi aux prêts, pièces, garanties, visites et fiches clients associées. Les tests de `scripts/test-local-workflow.mjs` couvrent le circuit Ségou, les refus interagences, le tour de rôle, la soumission répétée, les agents indisponibles et les réaffectations.

Chaque client est rattaché à une agence bancaire. Chaque agence possède son équipe de crédit : agents, analystes et comité. Les zones de couverture permettent de choisir un agent au sein de cette agence. Par exemple, un client rattaché à Ségou est traité par l’agence de Ségou et son équipe, jusqu’à la décision du comité de cette agence.

### Référentiel nécessaire

| Élément | Informations nécessaires |
| --- | --- |
| Agence | Identifiant stable, réseau, code et nom |
| Zone | Identifiant stable, libellé et agence de couverture |
| Client | Agence de rattachement et zone de résidence issue du référentiel |
| Membre de l’équipe | Identifiant, agence, rôle et disponibilité |
| Couverture agent | Agent, agence et zones prises en charge |
| Dossier de prêt | Compte épargne utilisé, agence responsable, zone retenue, agent affecté et état d’affectation |

La ville saisie librement ne suffit pas à effectuer une affectation. Le parcours doit permettre de sélectionner une zone du référentiel. Les libellés de villes, quartiers et agences ne remplacent pas leurs identifiants.

### À la soumission du prêt

1. Identifier l’agence du compte épargne utilisé pour le prêt et vérifier sa cohérence avec le rattachement du client. Si plusieurs comptes sont éligibles, le compte utilisé doit être explicite.
2. Vérifier que la zone du profil appartient à cette agence. Si la zone est absente ou couverte par une autre agence, refuser la soumission avec le message « La zone choisie doit appartenir à l’agence du compte épargne. Corrigez la zone, ou faites corriger le rattachement en agence. » Le dossier reste un brouillon. Aucune file d’attente et aucun transfert d’agence ne sont créés.
3. Enregistrer l’agence responsable et la zone du client sur le dossier.
4. Rechercher les agents actifs et disponibles qui couvrent cette zone dans cette agence.
5. Affecter automatiquement le dossier à l’agent éligible. Si plusieurs agents sont éligibles, les départager par un tour de rôle conservé par agence et zone.
6. Laisser le dossier à l’agent de cette agence. Aucune étape suivante n’est ouverte par la soumission.

Une nouvelle tentative de soumission du même dossier ne doit ni créer une seconde affectation ni faire avancer à nouveau le tour de rôle.

### Avancement du dossier

Le dossier ne change d’étape que par une action explicite du rôle qui le détient. Tant que cette action n’est pas déclenchée, il reste à l’étape courante, visible comme « en cours » pour le demandeur. Dès la transmission, l’étape précédente est verrouillée : l’agent ne modifie plus un dossier chez l’analyste, l’analyste ne modifie plus un dossier au comité, et le comité ne vote plus un dossier clos. Les boutons d’action de l’étape verrouillée sont désactivés. Si l’étape suivante renvoie le dossier en arrière (`VERIFICATION_REQUIRED`), il revient à l’agent et les actions de l’analyste sont verrouillées jusqu’à une nouvelle transmission. Le demandeur doit répondre au complément avant que l’agent puisse transmettre à nouveau.

| Étape | Statut | Qui le détient | Action qui fait avancer |
| --- | --- | --- | --- |
| Après soumission | `SUBMITTED` (ou `RECEIVED`, `UNDER_REVIEW`) | Agent de l’agence | « Transmettre à l’analyste » → `IN_ANALYSIS` |
| Analyse | `IN_ANALYSIS` (ou `PENDING_ANALYSIS`) | Analyste de la même agence | Transmission au comité → `PENDING_COMMITTEE` |
| Comité | `PENDING_COMMITTEE` (ou `COMMITTEE`) | Comité de la même agence | Décision → `APPROVED`, `AMENDED` ou `REJECTED` |

Une demande de complément ne fait pas avancer le dossier. Elle le ramène vers le demandeur avec le statut `VERIFICATION_REQUIRED`, sans ouvrir l’analyse ni le comité. Le demandeur voit cette demande en priorité dans « Mes demandes », devant les autres dossiers en cours : objet précis, puis la liste. Après correction, le dossier revient à l’agent ; il ne passe à l’analyste que lorsque l’agent déclenche à nouveau « Transmettre à l’analyste ».

### Rôles sur le dossier

L’agent vérifie le dossier dans son tiroir : identité, pièces, activité. Il peut demander un complément. Le popup impose un sujet (`PIECE`, `INFORMATION`, `FIELD_VISIT` ou `GUARANTEE`) et une précision d’au moins 5 caractères. `POST /agent/requests/{id}/request-complements` enregistre `complement_subject` et `complement_detail`, puis passe le dossier en `VERIFICATION_REQUIRED`. Le contrôle terrain et la confirmation de garantie restent des actions de l’agent. Le volet d’inspection n’affiche que la garantie du dossier : type, valeur déclarée, valeur retenue, statut, lieu, état, avis et observations seulement s’ils ont été enregistrés, et le fichier réellement joint. Aucune photo, adresse, décote ou taux de couverture d’exemple. `POST /agent/guarantees/{id}/verify` enregistre le statut, la valeur retenue et, lorsqu’ils sont saisis, le lieu, l’état, l’avis de voisinage et les observations. « Analyser 360° » n’est pas une action de l’agent.

Le pied du tiroir analyste n’a que deux actions : « Analyser 360° » et « Transmettre au comité ». La fiche 360° montre la solvabilité, les pièces et l’avis, et c’est là que se demande un complément. Sur chaque pièce, « Analyser la pièce » ouvre la lecture. « Conforme » enregistre le statut via `POST /analyst/requests/{id}/human-validation` avec `document_id`, puis verrouille le contrôle : « À reprendre » et « Non conforme » ne sont plus possibles. « À reprendre » et « Non conforme » restent possibles tant que la pièce n’est pas conforme. La croix du bandeau ferme le tiroir. Le même popup sert s’il renvoie le dossier au demandeur, via `POST /analyst/requests/{id}/review` avec `next_step` à `VERIFICATION_REQUIRED`, le même `subject` et le même `detail`. Il ne calcule pas le score et ne l’affiche pas.

Le score sur 100 et la recommandation restent uniquement au comité, au moment de la décision. Le calcul se fait à l’arrivée du dossier au comité, quand l’analyste transmet (`next_step` à `COMMITTEE`) : le dossier passe en `PENDING_COMMITTEE` et reçoit son analyse. La recommandation suit ce score (favorable dès 75, réservé dès 50, sinon défavorable). Elle ne reprend pas l’avis saisi par l’analyste. Le score pondère la capacité de remboursement au taux de 15 % (25 %), le comportement des échéances antérieures (20 %), la discipline d’épargne (15 %), l’ancienneté d’activité (15 %), la couverture de garantie (10 %), les pièces du dossier (10 %) et la zone (5 %). Sans échéancier antérieur, le comportement reste neutre. À la demande suivante, une échéance payée à temps ou pas encore due maintient ce facteur haut ; chaque échéance en retard le baisse. `GET /credit-requests/{id}/analysis` et `POST /credit-requests/{id}/score` sont refusés à l’agent et à l’analyste. Le comité lit ce score ; il ne le déclenche pas depuis son écran. Le montant accordé se saisit avec des espaces de milliers (`800 000`) et part au serveur comme un entier, sans espace ni suffixe `FCFA`. Le taux affiché est 15 %. Un accord ou un accord avec conditions verse le capital sur le compte épargne actif du client et lance l’échéancier. Sans compte épargne actif, l’octroi est refusé. Les dossiers accordés, amendés ou refusés restent dans la file du comité, ouvrables en consultation. Un refus n’enregistre rien tant que l’alerte n’est pas confirmée. L’alerte exige un pourquoi et un quoi d’au moins 5 caractères. Ajourner passe le dossier en `ADJOURNED` : pas de versement, pas d’échéancier, le vote est verrouillé, le comité le consulte dans « Ajournés » et le client voit le pourquoi et le quoi. Demander un complément à l’agent passe le dossier en `VERIFICATION_REQUIRED`, avec le sujet (`PIECE`, `INFORMATION`, `FIELD_VISIT` ou `GUARANTEE`) et le détail « Pourquoi : … Quoi : … ». L’agent le voit dans ses compléments. Le détail des composants d’interface est dans [ui-components.md](ui-components.md).

### Exceptions et réaffectations

- Aucun agent éligible : la soumission est acceptée et le dossier reste dans la file « À affecter » de son agence, avec le motif « Aucun agent disponible pour cette zone ». Le client le voit dans « En cours » et dans la liste, au statut soumis. L’administrateur affecte ensuite un agent disponible de la même agence, avec un motif. L’absence d’agent ne vaut pas refus du prêt et ne transfère pas le dossier.
- Zone manquante ou rattachée à une autre agence : refuser la soumission. Le client choisit une zone de l’agence du compte, ou le rattachement du compte est corrigé en agence avant un nouvel envoi.
- Agence introuvable ou rattachement incohérent : demander une correction du rattachement avant l’affectation ; ne pas choisir une agence par défaut.
- Changement de zone du client ou de couverture d’un agent : conserver l’affectation des dossiers déjà soumis. Les nouvelles règles concernent les nouvelles demandes.
- Réaffectation : action explicite d’un responsable autorisé, avec ancien et nouvel agent, auteur, date et motif. Un transfert entre agences doit également mettre à jour le circuit de traitement de façon explicite et tracée.

### Présentation et accès attendus

Le client suit ses dossiers par les compteurs et la liste de « Mes demandes ». L’agence responsable et l’agent affecté restent enregistrés sur le dossier pour l’équipe de l’agence.

L’agent voit les dossiers qui lui sont affectés. L’analyste et le comité voient les dossiers de leur agence aux étapes qui les concernent. Le responsable de l’agence dispose de la file « À affecter » et des actions de réaffectation. Un rôle de supervision interagences, s’il est ajouté, devra disposer d’une autorisation explicite.

Le transport local applique les limites d’agence et d’affectation aux listes, détails et actions, pas seulement à l’affichage. L’agent suit ses dossiers même après leur transmission ; les actions de transition restent réservées au rôle et à l’étape concernés. Le futur backend devra recalculer l’affectation à partir de ses référentiels et imposer les autorisations ; les identifiants envoyés par le navigateur ne constitueront pas une autorisation.

### Scénarios de validation frontend

- Un client de Ségou est affecté à un agent de sa zone à Ségou ; son dossier poursuit le circuit analyste et comité de Ségou.
- Un membre de l’équipe de Bamako ne peut ni consulter ce dossier ni agir dessus sans autorisation interagences.
- Deux agents éligibles reçoivent les nouveaux dossiers à tour de rôle ; un agent indisponible est exclu.
- Une zone sans agent disponible alimente la file de l’agence sans bloquer l’enregistrement de la demande. L’administrateur la réaffecte à un agent de la même agence.
- Une zone hors de l’agence du compte, ou une zone absente, refuse la soumission et laisse le dossier en brouillon.
- Une modification de profil ou de couverture ne déplace pas les dossiers existants ; une réaffectation autorisée laisse une trace.
- Une soumission répétée conserve l’affectation initiale.
- Tant que l’agent n’a pas transmis à l’analyste, le dossier reste à son étape. La même règle vaut pour l’analyste vers le comité, puis pour la décision du comité.
- Une demande de complément n’ouvre pas l’étape suivante. Le demandeur la voit en priorité dans « Mes demandes ».

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

Ce dépôt contient le frontend : aucun import bancaire réel ni rattachement à une banque réelle n’a été exécuté. Le rapprochement et la finalisation décrits ci-dessus sont simulés localement. Le backend devra imposer ces contrôles côté serveur, ainsi que les conditions de compte épargne et de pièces obligatoires lors de la soumission du prêt.
