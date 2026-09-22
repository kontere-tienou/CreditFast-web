export type MembershipField = { key: string; label: string; type?: 'text' | 'date' | 'email' | 'tel' | 'number'; required?: boolean; options?: string[] };
export type MembershipSection = { title: string; fields: MembershipField[] };
const f = (key: string, label: string, required = true, type: MembershipField['type'] = 'text'): MembershipField => ({ key, label, required, type });
const choice = (key: string, label: string, options: string[]): MembershipField => ({ key, label, required: true, options });
export const commonSection: MembershipSection = { title: 'Caisse et guichet', fields: [f('caisse', 'Caisse'), f('guichet', 'Guichet')] };
export const physicalSections: MembershipSection[] = [
  { title: '1. Identité du client', fields: [f('first_name', 'Prénoms'), f('last_name', 'Nom'), f('birth_date', 'Date de naissance', true, 'date'), f('birth_place', 'Lieu de naissance'), f('nationality', 'Nationalité'), f('origin_country', 'Pays d’origine'), choice('sex', 'Sexe', ['Féminin', 'Masculin']), f('father_name', 'Nom du père'), f('mother_name', 'Nom de la mère'), choice('marital_status', 'Situation matrimoniale', ['Célibataire', 'Marié(e)', 'Divorcé(e)', 'Veuf / Veuve']), f('occupation', 'Profession'), f('sector', 'Secteur d’activité')] },
  { title: '2. Coordonnées', fields: [f('city', 'Ville / village'), f('district', 'Quartier'), f('address', 'Adresse complète'), f('email', 'Email', false, 'email'), f('phone', 'Téléphone', true, 'tel')] },
  { title: '3. Pièce d’identité', fields: [choice('identity_type', 'Type de pièce', ['CNI', 'NINA', 'Passeport', 'Autre']), f('identity_number', 'N° de pièce'), f('identity_issued_at', 'Délivrée le', true, 'date'), f('identity_expires_at', 'Expire le', true, 'date'), f('identity_place', 'Lieu de délivrance')] },
  { title: '4. Activité économique et origine des fonds', fields: [choice('employment_status', 'Statut', ['Salarié', 'Commerçant', 'Profession libérale', 'Sans emploi', 'Autre']), f('employer', 'Nom de l’employeur', false), f('employer_address', 'Adresse de l’employeur', false), f('monthly_income', 'Revenus mensuels estimés (FCFA)', true, 'number'), f('funds_origin', 'Origine des fonds'), f('account_purpose', 'Usage principal du compte')] },
  { title: '5. Déclaration PPE', fields: [choice('pep', 'Êtes-vous une personne politiquement exposée (PPE) ?', ['Non', 'Oui']), f('pep_details', 'Si oui, lien / fonction', false)] },
];
export const legalSections: MembershipSection[] = [
  { title: '1. Identification de la société', fields: [f('company_name', 'Raison sociale'), choice('legal_form', 'Forme juridique', ['SA', 'SARL', 'GIE', 'Association', 'Coopérative', 'Autre']), f('tax_number', 'N° d’identification fiscale (NIF)'), f('registration_number', 'N° RCCM / Agrément'), f('receipt_number', 'N° récépissé (si association)', false), f('inps_number', 'N° INPS', false), f('headquarters', 'Adresse du siège'), f('email', 'Email', false, 'email'), f('phone', 'Téléphone', true, 'tel'), f('main_activity', 'Activité principale'), f('annual_turnover', 'Chiffre d’affaires annuel (FCFA)', true, 'number')] },
  { title: '3. Bénéficiaires effectifs', fields: [choice('majority_owner', 'Une personne physique détient-elle plus de 25 % du capital ?', ['Non', 'Oui']), f('beneficial_owners', 'Bénéficiaires : noms, dates et lieux de naissance, nationalités, liens avec la société'), f('indirect_control', 'Contrôle indirect / pouvoir de décision (décrire ou indiquer « Aucun »)')] },
  { title: '4. Origine des fonds et objectif', fields: [f('initial_funds_origin', 'Origine de l’apport initial'), f('planned_operations', 'Nature des opérations prévues')] },
  { title: '5. Déclaration PPE', fields: [choice('pep', 'Les dirigeants ou bénéficiaires sont-ils des PPE ?', ['Non', 'Oui']), f('pep_details', 'Si oui, personnes et fonctions concernées', false)] },
];
export function signatorySection(index: number): MembershipSection {
  const prefix = `signatory_${index}_`;
  return { title: `2. Dirigeants — Signataire ${index}`, fields: [f(prefix + 'name', 'Prénoms et nom'), f(prefix + 'birth_date', 'Date de naissance', true, 'date'), f(prefix + 'birth_place', 'Lieu de naissance'), f(prefix + 'nationality', 'Nationalité'), f(prefix + 'role', 'Fonction dans la société'), f(prefix + 'identity', 'Type et n° de pièce d’identité'), f(prefix + 'address', 'Adresse'), f(prefix + 'phone', 'Téléphone', true, 'tel')] };
}
export const closingSection: MembershipSection = { title: 'Adhésion', fields: [f('membership_date', 'Date d’adhésion', true, 'date'), f('membership_place', 'Lieu')] };
export const physicalDocuments = [ ['identity_copy', 'Copie certifiée de la pièce d’identité', true], ['address_proof', 'Justificatif de domicile', true], ['income_proof', 'Justificatif de revenus', false], ['photo', 'Photo du client', true], ['signature', 'Signature du client', true] ] as const;
export const legalDocuments = [ ['nif_copy', 'Copie NIF', true], ['rccm_copy', 'Copie RCCM', false], ['approval_copy', 'Copie agrément / récépissé', false], ['statutes_copy', 'Copie des statuts', true], ['mandate_copy', 'Copie mandat / procuration', true], ['directors_identity', 'Copies CNI des dirigeants', true], ['owners_identity', 'Copies CNI des bénéficiaires effectifs', true] ] as const;

export function validateMembership(fields: Record<string, string>, files: FormData, legal: boolean) {
  if (fields.pep === 'Oui' && !fields.pep_details?.trim()) return 'Précisez le lien ou la fonction de la personne politiquement exposée.';
  if (legal && !((files.get('rccm_copy') as File)?.size || (files.get('approval_copy') as File)?.size)) return 'Joignez une copie RCCM ou une copie agrément / récépissé.';
  if (legal && fields.legal_form === 'Association' && !fields.receipt_number?.trim()) return 'Indiquez le numéro de récépissé de l’association.';
  const today = new Date().toLocaleDateString('en-CA');
  for (const [key, value] of Object.entries(fields)) {
    if (key.endsWith('birth_date') && value >= today) return 'La date de naissance doit être antérieure à aujourd’hui.';
  }
  if (!legal && fields.identity_expires_at <= today) return 'La pièce d’identité doit être en cours de validité.';
  if (!legal && (fields.identity_issued_at > today || fields.identity_issued_at >= fields.identity_expires_at)) return 'Vérifiez les dates de délivrance et d’expiration de la pièce.';
  return null;
}
