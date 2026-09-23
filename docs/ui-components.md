# Composants d’interface

Cinq pièces sont réutilisées dans toute l’application. Les écrans ne redéfinissent pas leur hauteur, leur largeur ni leur police.

## Police

Deux traitements seulement.

| Traitement | Police | Usage |
| --- | --- | --- |
| Ordinaire | Inter (`--font-family-body`) | Libellés, phrases, avis, boutons |
| Montant | JetBrains Mono (`--font-family-code`), classe `cf-amount` | Sommes en FCFA, dans un champ ou à l’écran |

Les titres d’écran peuvent garder Plus Jakarta Sans (`--font-family-display`). Ce n’est pas une troisième police de contenu.

## Champ

`CfField` (`src/shared/ui/CfField.tsx`) est le seul champ de saisie. Il reprend `.form-control` et fixe la hauteur à `2.75rem`, sur toute la largeur du conteneur. Il n’utilise pas `type="number"`, donc les flèches du navigateur n’apparaissent pas.

| `kind` | Saisie | Exemple |
| --- | --- | --- |
| `text` | Texte libre | Nom, précision |
| `amount` | Entier avec espaces de milliers, police montant | `800 000` |
| `number` | Entier sans espace | Durée en mois, personnes à charge, compteur |
| `decimal` | Nombre à virgule, sans flèches | Taux `11.5` |

Tous les champs de saisie de l’application passent par `CfField`. La feuille de style retire aussi les flèches d’un éventuel `type="number"`.

### Montants à brancher sur `kind="amount"`

Déjà branchés sur `CfField` :

- Comité : montant accordé (`amount`), taux (`decimal`)
- Demande de prêt : revenu, charges, dettes, montant, valeur de garantie (`amount`) ; ancienneté, personnes à charge, durée (`number`)
- Profil et modification du profil : chiffre d’affaires, revenu, autres revenus, charges, autres mensualités (`amount`) ; personnes à charge (`number`)
- Simulateur : revenu net, charges (`amount`)
- Inspection : valeur déclarée et valeur retenue (`amount`)
- Garantie du demandeur : valeur estimée (`amount`)
- Agent : solde, montant d’opération, dépôts, retraits, solde moyen, solde de fin (`amount`) ; compteurs (`number`) ; latitude et longitude (`decimal`)
- Épargne : revenus mensuels, chiffre d’affaires annuel (`amount`), enregistrés comme entiers
- Encaissement : montant payé (`amount`)
- Poids d’une règle de score (`decimal`)

## Format des montants

`src/shared/format/money.ts` est le seul formateur.

- `formatAmount(800000)` donne `800 000`, avec un espace normal.
- `parseAmount` retire les espaces et tout caractère non numérique, puis renvoie un entier. `800 000` et `800000` donnent le même nombre.
- `parseDecimal` sert aux taux. Il accepte `11.5` et `11,5`.
- `formatFcfa` (`src/features/workflow/workflow.ts`) affiche `800 000 FCFA`. Il sert aux textes déjà montrés (tableaux, tiroirs, cartes). Le champ de saisie n’ajoute pas `FCFA` : le libellé du champ le porte.

Le serveur reçoit l’entier. L’espace n’est pas enregistré.

## Bouton

`Button` (`src/shared/ui/Button.tsx`) porte les variantes `primary`, `secondary`, `success`, `danger`, `warning` et `danger-subtle`, sur la classe `.btn`. Hauteur fixe : `40px`. Les boutons d’un modal ou d’un popup passent par ce composant.

Encore en `<button class="btn">`, hors de la coque : tiroirs (dossier agent, analyste, inspection, anomalies, compléments, échéancier, PV signé), lightbox, épargne (adhésion, historique, statut). Dans la demande de prêt, les deux actions de scan d’identité restent des boutons discrets (`btn-outline`, `btn-primary-subtle`).

## Modal

`AppModal` (`src/shared/ui/AppModal.tsx`) est le grand cadre. Largeurs : `sm` 460, `md` 560, `lg` 820, `xl` 960. Un `width` explicite reste possible (fiche agent : 760). Le fond, l’en-tête, l’icône et la fermeture ne se recopient plus.

Branchés :

- Modifier le profil
- Changer le mot de passe
- Créer un utilisateur
- Fiche client de l’agent
- Délibération du comité (`lg`, ouvert par `committee-modal`)
- Demande de prêt (`xl`, ouvert par `modal-loan-application`)
- Inspection (`lg`, ouvert par `modal-inspection`)
- Paiement (`md`, ouvert par `client-payment-modal`)
- Analyse 360° (`xl`, ouvert par `dossier-modal`)
- Rendez-vous (`md`, ouvert par `client-appointment-modal`)
- Dépôt de pièce (`md`, ouvert par `modal-upload-document`)
- Réglages (`md`, ouvert par `settings-modal`)
- Scanner (`md`, ouvert par `modal-qr-scanner`)
- Animation de succès (`sm`, ouvert par `modal-success-animation`)

Ces fenêtres ouvertes par identifiant gardent leur en-tête propre. L’épargne (adhésion et parcours) utilise une balise `dialog` native.

## Popup

`Popup` (`src/shared/ui/Popup.tsx`) est le petit cadre, largeur 460, au-dessus d’un modal ou d’un tiroir. Il reprend `AppModal` en `alertdialog`.

Branchés :

- Confirmation (`ConfirmAlert`)
- Demande de complément

Ses boutons sont des `Button`. Le champ de précision du complément reste une zone de texte.
