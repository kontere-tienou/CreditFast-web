import type { ClientProfile, FinancialAccount } from '@/api/profile';
import { isActiveSavingsAccount } from './accountPolicy';

function openingDate(value?: string) {
  if (!value) return 'Non renseignée';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Non renseignée' : new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}

export function SavingsAccountDetails({ account, profile }: { account: FinancialAccount; profile: ClientProfile }) {
  const status = (account.status ?? '').trim().toUpperCase();
  const active = isActiveSavingsAccount(account);
  const statusLabel = active ? 'Actif' : ({ PENDING: 'En attente de validation', INACTIVE: 'Inactif', INACTIF: 'Inactif', SUSPENDED: 'Suspendu', BLOCKED: 'Bloqué', CLOSED: 'Clôturé' } as Record<string, string>)[status] || account.status || 'Non renseigné';
  const holder = account.holder_name?.trim() || (profile.client_type === 'LEGAL_ENTITY'
    ? profile.company_name?.trim()
    : profile.user?.full_name?.trim() || profile.user?.name?.trim() || [profile.user?.first_name, profile.user?.last_name].filter(Boolean).join(' '));

  return <section className="savings-account-details" aria-label="Informations du compte">
    <header className="savings-account-details-header">
      <h3><i className="fas fa-building-columns" aria-hidden="true" /> Informations du compte</h3>
      <span className={`savings-account-status${active ? ' is-active' : ''}`}>{statusLabel}</span>
    </header>
    <dl className="savings-account-details-grid">
      <div><dt>Titulaire du compte</dt><dd>{holder || 'Non renseigné'}</dd></div>
      <div><dt>Numéro de compte</dt><dd className="savings-account-number">{account.account_number || 'En cours d’attribution'}</dd></div>
      <div><dt>Type de compte</dt><dd>Compte épargne</dd></div>
      <div><dt>Date d’ouverture</dt><dd>{openingDate(account.opened_at)}</dd></div>
      <div><dt>Caisse gestionnaire</dt><dd>{account.caisse_name || 'Non renseignée'}</dd></div>
      <div><dt>Guichet de rattachement</dt><dd>{account.guichet_name || 'Non renseigné'}</dd></div>
    </dl>
  </section>;
}
