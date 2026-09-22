# Adhésion épargne — contrat backend à implémenter

Le 22 septembre 2026, le schéma fourni par `https://creditfast-api.onrender.com/docs?api-docs.json`
documente `GET /api/profile` et `POST /api/agent/clients/{client}/financial-accounts`.
La seconde route est réservée aux agents et administrateurs : elle ne remplace pas une adhésion client.
Les routes ci-dessous ne figurent pas dans cette documentation. Le frontend les attend ;
Aucune validation ni soumission simulée n'est utilisée en cas d'indisponibilité.
Seuls les champs d'un brouillon et les paramètres du prêt sont conservés dans
`sessionStorage`, par utilisateur, et effacés à la déconnexion. Ce brouillon n'est
pas une adhésion transmise. Les fichiers non transmis doivent être sélectionnés
à nouveau ; il n'y a pas de synchronisation du brouillon entre appareils.
La fiche reste consultable si la route d'adhésion renvoie 404, 405 ou 501 ;
le bouton d'envoi reste désactivé jusqu'à ce que la vérification du statut réussisse.

Les chemins ci-dessous sont relatifs à `/api`, avec l'authentification Bearer existante.

## Lecture client

`GET /profile/savings-membership` (client connecté uniquement)

Réponse 200 : `{ "membership": null }` si aucune fiche, sinon `{ "membership": Membership }`.
Renvoyer la dernière fiche du client. Une erreur 404 n'est pas interprétée comme une absence de fiche.

## Création client

`POST /profile/savings-membership` — multipart/form-data :

- `client_type` : `PHYSICAL_PERSON` ou `LEGAL_ENTITY`, conforme au profil authentifié.
- `fields` : objet JSON de chaînes. Les clés et champs obligatoires sont décrits dans
  `src/features/savings/membershipFields.ts`. `signatory_count` vaut 1 à 3 pour une personne morale.
- `documents[<clé>]` : fichiers PDF/JPEG/PNG (10 Mo maximum chacun).
  Clés communes et par type dans le même fichier ; pour chaque signataire,
  `signatory_1_photo`, `signatory_1_signature`, etc.

Réponse 201 : `{ "membership": Membership }`, avec `status: "PENDING"` imposé par le serveur.
L'identité du client vient de la session. Ne jamais accepter un statut, un profil de risque,
une signature caisse ou un numéro de compte fournis par le client.
Créer le compte épargne associé au statut `PENDING` (sans numéro définitif) dans la même transaction.
Interdire les doublons : une seule adhésion en attente / un seul compte correspondant,
y compris en cas de requêtes concurrentes ou de relance après une coupure réseau (409).
Autoriser une nouvelle fiche après un refus, tout en conservant l'historique.

Valider côté serveur les champs obligatoires, dates, montants non négatifs, PPE et détails,
récépissé pour une association, fichiers et présence d'une pièce RCCM ou agrément / récépissé.
Vérifier le contenu réel des fichiers, les conserver dans un stockage privé, appliquer des quotas.
Si une sauvegarde échoue, ne laisser ni compte partiel ni documents orphelins.

## Administration

`GET /admin/savings-memberships?status=PENDING` — admin uniquement.
Réponse 200 : `{ "data": Membership[] }` (liste complète des adhésions en attente).

`GET /admin/savings-memberships/{id}/documents/{documentId}/file` — admin uniquement.
Vérifier l'appartenance du fichier à la fiche ; renvoyer le binaire avec Content-Type
et Content-Disposition: attachment. Ne pas exposer de liens publics permanents.

`POST /admin/savings-memberships/{id}/review` — admin uniquement, JSON :

```json
{
  "decision": "APPROVED",
  "account_number": "ML-001-456789",
  "risk_level": "LOW",
  "caisse_signature": "Nom du responsable"
}
```

Ou `{ "decision": "REJECTED", "rejection_reason": "Motif explicite" }`.
Risque : `LOW`, `MEDIUM`, `HIGH`. Numéro de compte unique et signature caisse obligatoires
pour valider ; motif obligatoire pour refuser. N'accepter que les fiches `PENDING` (409 sinon).
Effectuer la décision et l'activation du compte `EPARGNE` / `ACTIVE` atomiquement.
Réponse 200 seulement après validation de la transaction (ou 204 sans contenu).
Enregistrer l'administrateur connecté, l'horodatage, la décision et le risque dans l'audit.
L'affichage du nom du responsable ne constitue pas une signature électronique certifiée.

## Objet Membership

```ts
type Membership = {
  id: number;
  client_type: 'PHYSICAL_PERSON' | 'LEGAL_ENTITY';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED';
  applicant_name: string;
  rejection_reason?: string;
  correction_reason?: string;
  created_at?: string;
  reviewed_at?: string;
  reviewed_by?: string;
  fields: Record<string, string>;
  documents: { id: number; key: string; label: string; filename: string }[];
};
```

## Prérequis crédit à imposer au serveur

Le profil existant doit renvoyer les `financial_accounts` du client avec un statut explicite.
Les routes de création et soumission de crédit doivent refuser toute demande sans compte
épargne `ACTIVE` appartenant au client, quel que soit le canal (UI ou requête directe).
`PENDING`, `REJECTED`, `CLOSED`, `INACTIVE`, statut absent ou inconnu ne donnent aucun accès.
Le contrôle frontend améliore le parcours mais n'est pas une frontière d'autorisation.

## Recette avec backend

1. Sans compte : ouverture de la fiche, aucun dossier crédit créé.
2. Personne physique puis morale (1 à 3 signataires) : fichiers et champs persistés,
   compte `PENDING`, fiche consultable après reconnexion sur un autre appareil.
3. En attente : deuxième création refusée, soumission crédit directe refusée.
4. Agent/client : route d'approbation refusée (403), documents d'autrui inaccessibles.
5. Admin : vérification des pièces, validation atomique, audit, profil actualisé `ACTIVE`.
6. Client validé : le bouton de prêt ouvre le formulaire de crédit.
7. Refus : motif affiché, correction possible ; compte bloqué.
8. Panne réseau / double clic / validation concurrente : aucune activation ni duplication indue.

## Compléments, historique et comptes saisis par un agent

- `GET /admin/savings-memberships` sans filtre doit retourner l'historique complet,
  y compris les statuts APPROVED, REJECTED et CHANGES_REQUESTED. Le frontend applique
  la recherche et les filtres à cette liste. Si le backend pagine, adapter le client
  API pour parcourir les pages avant de considérer cette liste comme complète.
- La route de décision accepte aussi `{ "decision": "CHANGES_REQUESTED",
  "correction_reason": "Pièce illisible…" }`, uniquement depuis PENDING.
  Le compte associé reste non actif. Le motif est obligatoire.
- `POST /profile/savings-membership/{id}/resubmit` : même multipart que la création,
  autorisé uniquement au propriétaire pour REJECTED ou CHANGES_REQUESTED. Les champs
  sont préremplis côté client. `retained_document_ids` est un tableau JSON d'identifiants
  appartenant à cette fiche. Une pièce téléversée avec la même `key` remplace la pièce
  précédente. Ne pas supprimer les anciennes pièces avant le succès de la transaction.
  Réponse `{ membership: ... }` avec PENDING. Refuser les autres transitions (409).
- Chaque document retourné doit avoir sa `key` de formulaire, pour permettre la
  réutilisation des pièces reçues et la validation des champs obligatoires à la reprise.
- `GET /admin/financial-accounts?status=PENDING` : comptes institutionnels saisis
  par les agents (hors comptes déjà traités par une adhésion), réponse `{ data: [...] }`.
  Chaque ligne contient `id`, `account_number`, `client_name`, `account_type`.
- `POST /admin/financial-accounts/{id}/review` : admin uniquement ; corps
  `{ decision: "APPROVED" }` ou `{ decision: "REJECTED", rejection_reason: "..." }`.
  Activation atomique seulement si PENDING, contrôle d'accès et audit obligatoires.
  L'API de saisie agent doit imposer PENDING, même si une requête directe envoie ACTIVE.
  Une réponse de succès confirme la décision persistée. Pas d'activation par le frontend.

## Notifications attendues

Émettre via le système de notifications existant :

- `SAVINGS_MEMBERSHIP_SUBMITTED` : client (accusé de réception) et admin (à traiter).
- `SAVINGS_MEMBERSHIP_APPROVED` : client, seulement après activation effective.
- `SAVINGS_MEMBERSHIP_REJECTED` : client, motif inclus.
- `SAVINGS_MEMBERSHIP_CHANGES_REQUESTED` : client, éléments à compléter inclus.

Le frontend affiche ces libellés et ouvre `/app/client/savings` pour le client,
`/app/admin/savings` pour l'administrateur. Le backend reste responsable de leur émission.

Recette complémentaire : fermer/réouvrir la fiche, recharger la page, vérifier
l'isolation des brouillons entre utilisateurs et l'effacement à la déconnexion ;
refuser puis corriger une fiche en conservant ses pièces ; demander des compléments,
resoumettre et vérifier PENDING ; filtrer l'historique ; reprendre le montant,
la durée et l'objet du prêt après activation du compte dans la même session.
