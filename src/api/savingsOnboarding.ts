import { apiJson } from './client';
import type { Membership } from './savings';
export type SavingsAgency = { code: string; network: string; city: string; name: string; address: string };
export type SavingsOnboardingStatus = 'MATCHED' | 'NOT_FOUND' | 'REVIEW_REQUIRED' | 'INACTIVE';
export type SavingsOnboarding = { status: SavingsOnboardingStatus; application: Membership | null; agencies: SavingsAgency[] };

function isStatus(value: unknown): value is SavingsOnboardingStatus {
  return value === 'MATCHED' || value === 'NOT_FOUND' || value === 'REVIEW_REQUIRED' || value === 'INACTIVE';
}

/** The API sends `has_active_savings_account`. The local store sends `status`. */
export function normalizeSavingsOnboarding(payload: unknown): SavingsOnboarding {
  const raw = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const application = (raw.application ?? raw.pending_application ?? null) as Membership | null;
  const agencies = Array.isArray(raw.agencies) ? raw.agencies as SavingsAgency[] : [];
  if (raw.has_active_savings_account === true) {
    return { status: 'MATCHED', application, agencies };
  }
  if (isStatus(raw.status)) {
    return { status: raw.status, application, agencies };
  }
  if (raw.has_active_savings_account === false) {
    return { status: 'NOT_FOUND', application, agencies };
  }
  return { status: 'REVIEW_REQUIRED', application, agencies };
}

export const getSavingsOnboarding = async () => normalizeSavingsOnboarding(await apiJson<unknown>('/profile/savings-onboarding'));
export const submitSavingsPreApplication = (body: Record<string, string>) => apiJson<Membership>('/profile/savings-pre-applications', { method: 'POST', body: JSON.stringify(body) });
export const verifySavingsIdentity = (application: Membership, body: Record<string, string | boolean>) => apiJson(`/agent/bank-account-applications/${application.client_type === 'LEGAL_ENTITY' ? 'legal-entity' : 'physical-person'}/${application.id}/verify-identity`, { method: 'POST', body: JSON.stringify(body) });
