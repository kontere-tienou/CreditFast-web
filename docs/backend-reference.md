# Référence backend — interface CreditFast

Contrat pour l’intégrateur. Il décrit les endpoints que l’interface appelle vraiment, et la logique que le serveur doit appliquer. Le navigateur n’est pas une autorisation : chaque contrôle ci-dessous se refait côté serveur.

Le récit du parcours reste dans [client-entry-workflow.md](client-entry-workflow.md). L’adhésion épargne détaillée est dans [savings-api.md](savings-api.md). Ce fichier est le plan d’intégration.

Les montants partent en entiers FCFA, sans espace et sans suffixe. L’affichage `10 000` est uniquement visuel. Le taux du prêt, du score et de l’échéancier est **15 % par an**, intérêt simple : `intérêt = arrondi(capital × 0,15 × mois / 12)`, `total = capital + intérêt`, `mensualité = arrondi(total / mois)`, la dernière échéance absorbe le reste.

## Rôles

| Rôle API | Écran |
| --- | --- |
| `client` | Espace client |
| `credit_agent` | Agent |
| `analyst` | Analyste |
| `committee_member` | Comité |
| `admin` | Responsable |

Un membre d’équipe ne lit un dossier que s’il est de la même agence, que le dossier n’est pas un brouillon, et, pour l’agent, que le dossier lui est affecté. L’administrateur lit l’ensemble. Le client ne lit que ses dossiers.

## Qui détient le dossier

| Statut | Détenteur | Action suivante |
| --- | --- | --- |
| `DRAFT` | Client | `POST /credit-requests/{id}/submit` |
| `SUBMITTED`, `RECEIVED`, `UNDER_REVIEW` | Agent | Transmettre, ou demander un complément |
| `VERIFICATION_REQUIRED` | Agent, après réponse du client | Le client corrige d’abord. L’agent ne retransmet pas tant que le client n’a pas répondu |
| `IN_ANALYSIS`, `PENDING_ANALYSIS` | Analyste | Transmettre au comité, ou renvoyer un complément |
| `PENDING_COMMITTEE`, `COMMITTEE` | Comité | Décider |
| `APPROVED`, `AMENDED`, `REJECTED` | Clos | Consultation seulement |
| `ADJOURNED` | Clos pour le vote | Consultation. Message : « Ce dossier est ajourné. Le vote est verrouillé. » |

Tant que le dossier n’est pas chez le rôle qui agit, répondre `403` avec le message de verrouillage. Un dossier clos répond « Ce dossier est clos. Cette étape est verrouillée. »

## Connexion

| Écran | Méthode | Endpoint | Logique |
| --- | --- | --- | --- |
| Connexion client (téléphone) | POST | `/auth/client/login` | Corps `phone`, `password`. Réponse `{ token, user }` |
| Connexion équipe (e-mail) | POST | `/auth/staff/login` | Corps `email`, `password`. Réponse `{ token, user }` |
| Inscription | POST | `/auth/register` | Crée un client sans compte épargne, KYC `PENDING`. Ne rattache pas un client bancaire existant |
| Session | GET | `/auth/me` | `{ user }` |
| Mot de passe | POST | `/auth/password` | |
| Déconnexion | POST | `/auth/logout` | |

## Espace client

| Écran | Méthode | Endpoint | Logique |
| --- | --- | --- | --- |
| Profil | GET, PUT | `/profile` | Le profil porte les comptes `financial_accounts` : `account_number`, `account_type` (`EPARGNE` ou `SAVINGS`), `status` (`ACTIF` ou `ACTIVE`), `balance`, `available_balance`, `blocked_balance`, `agency_code` |
| Contrôle du compte | GET | `/profile/account-check` | Voir la section dédiée. Appelé à l’ouverture de la demande de prêt |
| Profil financier | GET, PUT | `/profile/financial-profile` | Revenu, dépenses, personnes à charge. La demande de prêt ne réécrit pas ces montants |
| Activité | GET, POST, PUT, DELETE | `/profile/activities` et `/profile/activities/{id}` | |
| Pièces d’identité | GET, POST, DELETE | `/profile/kyc-documents` et `/profile/kyc-documents/{id}` | Une CNI, NINA ou un passeport est requis avant la demande de prêt |
| Fichier de pièce | GET | `/kyc-documents/{id}/file` | |
| Photo | GET, POST, DELETE | `/profile-photo` | |
| Historique épargne | GET | `/profile/financial-accounts/{id}/transactions` | Un client ne lit pas le compte d’un autre. Chaque opération : `reference`, `booked_at`, `label`, `type`, `direction` (`CREDIT` ou `DEBIT`), `amount` positif, `status`, `channel`, `balance_after` |
| Pré-demande d’épargne | GET | `/profile/savings-onboarding` | |
| Pré-demande d’épargne | POST | `/profile/savings-pre-applications` | Ne crée pas un compte. Une demande en cours ne se duplique pas |
| Mes demandes | GET | `/credit-requests` | Compteurs : toutes, brouillons, en cours, accordées. `ADJOURNED` s’affiche avec pourquoi et quoi |
| Brouillon | POST | `/credit-requests` | Statut `DRAFT`. Le serveur recopie le contrôle du compte |
| Reprise | GET, PUT, DELETE | `/credit-requests/{id}` | PUT seulement en `DRAFT` ou `VERIFICATION_REQUIRED`, et seulement par le client |
| Soumission | POST | `/credit-requests/{id}/submit` | Voir le routage |
| Pièces du dossier | GET, POST, DELETE | `/credit-requests/{id}/documents` | |
| Fichier | GET | `/documents/{id}/file` | |
| Garantie | GET, POST, PUT, DELETE | `/credit-requests/{id}/guarantees` | |
| Fichier de garantie | GET | `/guarantees/{id}/file` | |
| Produits | GET | `/credit-products` | |
| Simulation | POST | `/simulations/installments` | Même barème à 15 % que l’octroi : `monthly_payment`, `total_interest`, `total_amount`, `interest_rate` |
| Échéancier | GET | `/loans`, `/loans/{id}`, `/loans/{id}/repayments` | |
| Catalogue agences et zones | GET | `/routing/catalog` | La zone choisie appartient à l’agence du compte épargne |

### Contrôle du compte — `GET /profile/account-check`

Réponse :

```json
{
  "monthly_income": 450000,
  "monthly_expenses": 150000,
  "ongoing_credit_count": 2
}
```

- `monthly_income` et `monthly_expenses` viennent du profil financier tenu par le compte, pas de la saisie du formulaire.
- `ongoing_credit_count` est le **nombre** de prêts du client au statut `ACTIVE` ou `APPROVED`. Ce n’est pas un montant.
- À `POST /credit-requests` et `PUT /credit-requests/{id}`, le serveur recopie ces trois valeurs (`declared_monthly_income`, `declared_monthly_expenses`, `ongoing_credit_count`). Toute `existing_debt_payment` envoyée par le formulaire est ignorée et n’est pas conservée.
- Le client ne peut pas modifier ces trois champs dans la demande de prêt.

Le score, lui, a besoin du montant. Il le calcule tout seul : somme des `monthly_payment` arrondies des autres prêts `ACTIVE` ou `APPROVED` du même client. Ce montant ne s’affiche pas dans le formulaire.

### Soumission et affectation

`POST /credit-requests/{id}/submit`, dossier en `DRAFT` ou `VERIFICATION_REQUIRED` :

1. Compte épargne actif obligatoire.
2. La zone du profil appartient à l’agence de ce compte. Sinon `422` : « La zone choisie doit appartenir à l’agence du compte épargne. Corrigez la zone, ou faites corriger le rattachement en agence. » Le dossier reste un brouillon.
3. Enregistrer l’agence et la zone sur le dossier.
4. Affecter un agent actif, disponible, de cette agence et de cette zone. Plusieurs agents : tour de rôle par agence et zone. Aucun agent : le dossier est quand même soumis, file « À affecter », motif « Aucun agent disponible pour cette zone ».
5. Une seconde soumission du même dossier déjà `SUBMITTED` ne crée pas une nouvelle affectation.

Pas de transfert entre agences.

## Agent

| Écran | Méthode | Endpoint | Logique |
| --- | --- | --- | --- |
| Dossiers affectés | GET | `/agent/requests` | Même forme que la liste des demandes, filtrée par l’agent |
| Transmettre à l’analyste | POST | `/agent/requests/{id}/send-to-analysis` | Depuis `SUBMITTED`, `RECEIVED` ou `UNDER_REVIEW`, et seulement si le dossier est affecté. Passe en `IN_ANALYSIS`. Refusé en `VERIFICATION_REQUIRED` tant que le client n’a pas répondu |
| Complément | POST | `/agent/requests/{id}/request-complements` | Corps `subject` (`PIECE`, `INFORMATION`, `FIELD_VISIT`, `GUARANTEE`) et `detail` d’au moins 5 caractères. Passe en `VERIFICATION_REQUIRED`. N’ouvre pas l’analyse |
| Garantie | POST | `/agent/guarantees/{id}/verify` | Tant que le dossier est chez l’agent. Enregistre statut, valeur retenue, lieu, état, avis, observations |
| Clients | GET | `/agent/clients`, `/agent/clients/{id}`, `/agent/clients/{id}/kyc` | |
| Contrôle d’identité | POST | `/agent/clients/{id}/kyc-documents/{documentId}/verify` | |
| Visites | GET, POST | `/agent/requests/{id}/field-visits` | |
| Visite | GET, PUT, POST | `/agent/field-visits/{id}`, `.../start`, `.../complete`, `.../cancel` | |
| Adhésion épargne | GET, POST | `/agent/bank-account-applications/{physical-person\|legal-entity}` et `.../{id}/approve`, `reject`, `return`, `verify-identity` | Voir [savings-api.md](savings-api.md) |

`GET /credit-requests/{id}/analysis` et `POST /credit-requests/{id}/score` répondent `403` à l’agent.

## Analyste

| Écran | Méthode | Endpoint | Logique |
| --- | --- | --- | --- |
| Dossiers en analyse | GET | `/analyst/requests` | Dossiers de son agence à son étape |
| Avis pour le comité | POST | `/analyst/requests/{id}/review` | Depuis `IN_ANALYSIS` ou `PENDING_ANALYSIS` |
| Conformité d’une pièce | POST | `/analyst/requests/{id}/human-validation` | Corps `document_id`, `decision`. Une pièce déjà conforme est verrouillée |
| Anomalies | GET | `/analyst/requests/{id}/anomalies` | |
| Lever une anomalie | POST | `/analyst/anomalies/{id}/resolve` | |

`review` avec `next_step = COMMITTEE` passe le dossier en `PENDING_COMMITTEE` et **calcule le score à ce moment-là**. Le commentaire de l’analyste est ajouté au résumé. Il ne devient pas la recommandation.

`review` avec `next_step = VERIFICATION_REQUIRED` ramène le dossier au client, avec le même `subject` et le même `detail` que le complément agent. Pas de score.

`GET /credit-requests/{id}/analysis` et `POST /credit-requests/{id}/score` répondent `403` à l’analyste. L’écran analyste n’affiche pas le score.

## Comité

| Écran | Méthode | Endpoint | Logique |
| --- | --- | --- | --- |
| File | GET | `/committee/requests` | Dossiers de l’agence au comité, plus les dossiers déjà décidés pour consultation |
| Score | GET | `/credit-requests/{id}/analysis` | Réservé au comité et à l’administrateur. Le score existe déjà : il a été calculé à l’arrivée |
| Décision | POST | `/committee/requests/{id}/decide` | Seulement depuis `PENDING_COMMITTEE` ou `COMMITTEE` |

Le score sur 100 et la recommandation ne s’affichent qu’ici. Pas de bouton de calcul.

### Score calculé à l’arrivée au comité

Pondération, total 100 :

| Facteur | Poids | Règle |
| --- | --- | --- |
| Capacité | 25 | Reste à vivre = revenu − dépenses − somme des mensualités des autres prêts actifs. Couverture = reste à vivre / mensualité du dossier à 15 %. ≥ 1,8 → 95 ; ≥ 1,4 → 85 ; ≥ 1,15 → 70 ; ≥ 0,9 → 45 ; sinon 20 |
| Historique | 20 | Aucun prêt antérieur → 70. Prêt antérieur et aucune échéance en retard → 95. Chaque retard −30, plancher 20. En retard : payée après l’échéance, ou impayée et échue. Une échéance future impayée n’est pas en retard |
| Épargne | 15 | Solde du compte épargne actif. ≥ 1 000 000 → 90 ; ≥ 400 000 → 75 ; > 0 → 60 ; sinon 40 |
| Activité | 15 | Années × 15, plafond 95. Inconnue → 55 |
| Garantie | 10 | Couverture / montant. ≥ 1,2 → 95 ; ≥ 0,8 → 80 ; > 0 → 65 ; aucune → 35. Valeur vérifiée, sinon valeur déclarée |
| Pièces du dossier | 10 | Toutes vérifiées → 90 ; mélange → 55 ; aucune pièce sur le dossier → 50. Les pièces KYC sans `credit_request_id` ne comptent pas |
| Zone | 5 | Zone ou ville présente → 75 ; sinon 60 |

Recommandation : ≥ 75 `FAVORABLE`, ≥ 50 `RESERVED`, sinon `UNFAVORABLE`. Elle suit le score, pas l’avis de l’analyste.

La réponse d’analyse expose `overall_score`, `confidence_score`, `recommendation`, `repayment_capacity_score`, `credit_history_score`, `savings_score`, `activity_score`, `guarantee_score`, `document_score`, `analysis_summary`.

### Décision — `POST /committee/requests/{id}/decide`

| `decision` | Effet |
| --- | --- |
| `APPROVED` | Accord du montant et de la durée proposés, ou de ceux envoyés |
| `AMENDED` | Accord avec le montant ou la durée saisis, différents de la demande |
| `ADJOURNED` | Pas de prêt, pas de versement. `reason` et `what` d’au moins 5 caractères. Le client et la consultation comité voient ces deux textes |
| `VERIFICATION_REQUIRED` | Complément à l’agent. `reason`, `what` (≥ 5 caractères) et `subject` (`PIECE`, `INFORMATION`, `FIELD_VISIT`, `GUARANTEE`). `complement_detail` = `Pourquoi : {reason}. Quoi : {what}` |
| `REJECTED` | Refus clos, sans versement. L’interface n’utilise plus ce chemin : le refus passe par l’alerte, donc par `ADJOURNED` ou `VERIFICATION_REQUIRED` |

Un accord (`APPROVED` ou `AMENDED`) :

1. Refuser si le client n’a pas de compte épargne actif : « Le client n’a pas de compte épargne actif. L’octroi ne peut pas verser les fonds. »
2. Créditer le **capital** (pas les intérêts) sur ce compte.
3. Écrire une opération `type = LOAN_DISBURSEMENT`, `direction = CREDIT`, `status = COMPLETED`, libellé `Épargne + prêt #{id}`, référence `EP-PRET-{id}`, canal `Compte épargne`, avec `balance_after`.
4. Créer le prêt au statut `ACTIVE`, déjà versé (`disbursed_at`, `funds_received`, `savings_account_id`). `outstanding_amount` est le total avec intérêts.
5. Créer les échéances `PENDING`.

`POST /loans/{id}/disburse` après cet octroi échoue : les fonds sont déjà versés. Le statut n’est plus `APPROVED`.

Enregistrer un remboursement, `POST /loans/{id}/repayments/{repaymentId}/record`, diminue le restant dû. Le client peut valider le règlement de sa propre échéance. L’agent et l’administrateur le peuvent aussi. Le décaissement reste réservé à l’équipe. Ce règlement ne débite pas le compte épargne.

Les dossiers `APPROVED`, `AMENDED`, `REJECTED` et `ADJOURNED` restent listés pour consultation. Les champs de vote sont désactivés.

## Responsable

| Écran | Méthode | Endpoint | Logique |
| --- | --- | --- | --- |
| File à affecter | GET | `/routing/requests` | Dossiers non brouillon |
| Affecter | POST | `/routing/requests/{id}/assign` | Agent disponible de la même agence, motif obligatoire. Trace : auteur, ancien agent, nouvel agent, date, motif |
| Couverture d’un agent | PUT | `/routing/agents/{id}` | `agency_code`, `zone_codes`, `available` |
| Utilisateurs | GET, POST, PUT, DELETE | `/admin/users` | |
| Mot de passe d’un utilisateur | POST | `/admin/users/{id}/password` | |

Une réaffectation ne déplace pas le dossier vers une autre agence.

## Ce que le serveur doit refuser

- Lire ou agir sur un dossier d’une autre agence, ou sur un dossier non affecté à cet agent.
- Laisser le client fixer son revenu, ses dépenses ou le nombre de crédits en cours dans la demande.
- Calculer ou montrer le score avant l’arrivée au comité, ou le montrer à l’agent et à l’analyste.
- Verser un prêt sans compte épargne actif, ou verser les intérêts en plus du capital.
- Encaisser un second décaissement après l’octroi.
- Accepter un ajournement ou un complément comité sans pourquoi et quoi d’au moins 5 caractères.
- Accepter un complément sans sujet dans `PIECE`, `INFORMATION`, `FIELD_VISIT`, `GUARANTEE`, ou avec un détail de moins de 5 caractères.
- Faire avancer un dossier par une simple consultation.
- Transférer un dossier d’une agence à une autre.
