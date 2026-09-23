import { getAccessToken } from '@/app/session';
import { isApiError } from '@/api/errors';
import {
  fetchAccountCheck,
  fetchClientProfile,
  fetchFinancialProfile,
  hasActiveSavingsAccount,
  hasRequiredIdentityDocument,
  listKycDocuments,
  type ClientProfile,
  type FinancialProfile,
} from '@/api/profile';
import { requireActiveSavingsAccount } from '@/api/savings';
import { getSavingsOnboarding, type SavingsOnboarding } from '@/api/savingsOnboarding';

export type CreditWorkflowState =
  | 'AUTH_REQUIRED'
  | 'CLIENT_PROFILE_REQUIRED'
  | 'FINANCIAL_PROFILE_REQUIRED'
  | 'SAVINGS_ACCOUNT_INACTIVE'
  | 'SAVINGS_MEMBERSHIP_REQUIRED'
  | 'SAVINGS_MEMBERSHIP_PENDING'
  | 'SCORE_UNAVAILABLE'
  | 'NOT_ELIGIBLE'
  | 'ELIGIBLE';

export type CreditWorkflowAction =
  | 'OPEN_CLIENT_PROFILE_MODAL'
  | 'OPEN_IDENTITY_DOCUMENTS'
  | 'OPEN_FINANCIAL_PROFILE_MODAL'
  | 'OPEN_SAVINGS_MEMBERSHIP_MODAL'
  | 'OPEN_LOAN_APPLICATION_MODAL'
  | null;

export type CreditWorkflowResult = {
  command: 'DEMANDER_CREDIT';
  state: CreditWorkflowState;
  action: CreditWorkflowAction;
};

function creditResult(
  state: CreditWorkflowState,
  action: CreditWorkflowAction,
): CreditWorkflowResult {
  return { command: 'DEMANDER_CREDIT', state, action };
}

function hasDeclaredAmounts(profile: FinancialProfile | null) {
  return (
    profile != null &&
    typeof profile.monthly_income === 'number' &&
    Number.isFinite(profile.monthly_income) &&
    typeof profile.monthly_expenses === 'number' &&
    Number.isFinite(profile.monthly_expenses)
  );
}

export function financialProfileGate(
  profile: FinancialProfile | null,
): CreditWorkflowResult | null {
  if (hasDeclaredAmounts(profile)) {
    return null;
  }
  return creditResult('FINANCIAL_PROFILE_REQUIRED', 'OPEN_FINANCIAL_PROFILE_MODAL');
}

export function savingsMembershipGate(
  onboarding: SavingsOnboarding,
): CreditWorkflowResult {
  const application = onboarding.application;
  const waiting =
    application != null &&
    application.status !== 'REJECTED' &&
    application.status !== 'CHANGES_REQUESTED';
  if (waiting) {
    return creditResult('SAVINGS_MEMBERSHIP_PENDING', null);
  }
  if (onboarding.status === 'INACTIVE') {
    return creditResult('SAVINGS_ACCOUNT_INACTIVE', null);
  }
  return creditResult('SAVINGS_MEMBERSHIP_REQUIRED', 'OPEN_SAVINGS_MEMBERSHIP_MODAL');
}

export function scoreInputGate(check: FinancialProfile | null): CreditWorkflowResult | null {
  if (hasDeclaredAmounts(check)) {
    return null;
  }
  return creditResult('SCORE_UNAVAILABLE', null);
}

async function clientProfileGate(
  profile: ClientProfile | null,
): Promise<CreditWorkflowResult | null> {
  if (!profile) {
    return creditResult('CLIENT_PROFILE_REQUIRED', 'OPEN_CLIENT_PROFILE_MODAL');
  }
  if (!hasRequiredIdentityDocument(await listKycDocuments())) {
    return creditResult('CLIENT_PROFILE_REQUIRED', 'OPEN_IDENTITY_DOCUMENTS');
  }
  return null;
}

async function savingsGate(profile: ClientProfile): Promise<CreditWorkflowResult | null> {
  if (hasActiveSavingsAccount(profile)) {
    return null;
  }
  return savingsMembershipGate(await getSavingsOnboarding());
}

async function eligibilityGate(): Promise<CreditWorkflowResult> {
  try {
    await requireActiveSavingsAccount();
  } catch (error) {
    if (isApiError(error)) {
      throw error;
    }
    return creditResult('NOT_ELIGIBLE', null);
  }
  return creditResult('ELIGIBLE', 'OPEN_LOAN_APPLICATION_MODAL');
}

export async function runCreditWorkflow(): Promise<CreditWorkflowResult> {
  if (!getAccessToken()) {
    return creditResult('AUTH_REQUIRED', null);
  }

  const profile = await fetchClientProfile();
  const client = await clientProfileGate(profile);
  if (client) {
    return client;
  }

  const finances = financialProfileGate(await fetchFinancialProfile());
  if (finances) {
    return finances;
  }

  const savings = await savingsGate(profile as ClientProfile);
  if (savings) {
    return savings;
  }

  const score = scoreInputGate(await fetchAccountCheck());
  if (score) {
    return score;
  }

  return eligibilityGate();
}
