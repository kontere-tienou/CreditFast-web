import { getAccessToken } from '@/app/session';
import { fetchClientProfile, type FinancialAccount } from '@/api/profile';
import { isActiveSavingsAccount } from '@/features/savings/accountPolicy';
import { workflowResult, type WorkflowResult } from '../WorkflowResult';
import type { BalanceData, SavingsBalanceAccount } from '../types';

function reportedBalance(account: FinancialAccount): number | null {
  return typeof account.balance === 'number' && Number.isFinite(account.balance)
    ? account.balance
    : null;
}

function toBalanceAccount(account: FinancialAccount): SavingsBalanceAccount {
  return {
    id: account.id,
    accountNumber: account.account_number,
    balance: reportedBalance(account),
  };
}

export function balanceFromAccounts(accounts: FinancialAccount[]): WorkflowResult<BalanceData | null> {
  const active = accounts.filter(isActiveSavingsAccount).map(toBalanceAccount);
  if (!active.length) {
    return workflowResult('MON_SOLDE', 'NO_ACTIVE_SAVINGS', null);
  }
  const reported = active.some((account) => account.balance != null);
  return workflowResult('MON_SOLDE', reported ? 'READY' : 'BALANCE_MISSING', { accounts: active });
}

export async function runBalanceWorkflow(): Promise<WorkflowResult<BalanceData | null>> {
  if (!getAccessToken()) {
    return workflowResult('MON_SOLDE', 'UNAUTHENTICATED', null);
  }
  const profile = await fetchClientProfile();
  if (!profile) {
    return workflowResult('MON_SOLDE', 'PROFILE_UNAVAILABLE', null);
  }
  return balanceFromAccounts(profile.financial_accounts ?? []);
}
