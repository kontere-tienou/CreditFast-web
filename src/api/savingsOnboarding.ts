import { apiJson } from './client';
import type { Membership } from './savings';
export type SavingsAgency = { code: string; network: string; city: string; name: string; address: string };
export type SavingsOnboarding = { status: 'MATCHED' | 'NOT_FOUND' | 'REVIEW_REQUIRED' | 'INACTIVE'; application: Membership | null; agencies: SavingsAgency[] };
export const getSavingsOnboarding = () => apiJson<SavingsOnboarding>('/profile/savings-onboarding');
export const submitSavingsPreApplication = (body: Record<string, string>) => apiJson<Membership>('/profile/savings-pre-applications', { method: 'POST', body: JSON.stringify(body) });
export const verifySavingsIdentity = (application: Membership, body: Record<string, string | boolean>) => apiJson(`/agent/bank-account-applications/${application.client_type === 'LEGAL_ENTITY' ? 'legal-entity' : 'physical-person'}/${application.id}/verify-identity`, { method: 'POST', body: JSON.stringify(body) });
