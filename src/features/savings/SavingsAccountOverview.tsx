import type { ClientProfile, FinancialAccount } from '@/api/profile';
import { SavingsAccountDetails } from './SavingsAccountDetails';
import { SavingsTransactionHistory } from './SavingsTransactionHistory';
import './savings-dashboard.css';

export function SavingsAccountOverview({ account, profile }: { account: FinancialAccount; profile: ClientProfile }) {
  const holder = account.holder_name || (profile.client_type === 'LEGAL_ENTITY' ? profile.company_name : profile.user?.full_name) || 'Titulaire non renseigné';
  return <section className="sf-dashboard" aria-label={`Compte épargne ${account.account_number || ''}`}>
    <SavingsTransactionHistory account={account} holder={holder} />
    <details className="sf-account-disclosure">
      <summary><span><i className="fas fa-building-columns" aria-hidden="true" /> Informations du compte</span><span>{account.account_number || 'Numéro non renseigné'} <i className="fas fa-chevron-down" aria-hidden="true" /></span></summary>
      <SavingsAccountDetails account={account} profile={profile} />
    </details>
  </section>;
}
