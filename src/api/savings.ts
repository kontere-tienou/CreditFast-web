import { apiBlob, apiJson } from './client';
import { unwrapCollection } from './admin';
import { fetchClientProfile, hasActiveSavingsAccount } from './profile';

export type Membership = {
  id: number;
  client_type: 'PHYSICAL_PERSON' | 'LEGAL_ENTITY';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  applicant_name: string;
  rejection_reason?: string;
  fields: Record<string, string>;
  documents: { id: number; label: string; filename: string }[];
};

// Contract documented in docs/savings-api.md; the server owns approval and account creation.
export async function getMembership(): Promise<Membership | null> {
  const result = await apiJson<{ membership: Membership | null }>('/profile/savings-membership');
  return result.membership;
}

export async function createMembership(body: FormData) {
  const result = await apiJson<{ membership: Membership }>('/profile/savings-membership', { method: 'POST', body });
  if (!result.membership?.id || result.membership.status !== 'PENDING') {
    throw new Error('La mise en attente de votre adhésion n’a pas été confirmée. Actualisez son statut avant de réessayer.');
  }
  return result.membership;
}

export async function listPendingMemberships() {
  return unwrapCollection<Membership>(await apiJson<unknown>('/admin/savings-memberships?status=PENDING'));
}

export function reviewMembership(id: number, body: { decision: 'APPROVED' | 'REJECTED'; account_number?: string; risk_level?: string; caisse_signature?: string; rejection_reason?: string }) {
  return apiJson(`/admin/savings-memberships/${id}/review`, { method: 'POST', body: JSON.stringify(body) });
}

export function membershipDocument(id: number, documentId: number) {
  return apiBlob(`/admin/savings-memberships/${id}/documents/${documentId}/file`);
}

export async function requireActiveSavingsAccount() {
  if (!hasActiveSavingsAccount(await fetchClientProfile())) {
    throw new Error('Un compte épargne actif, validé par l’administrateur, est nécessaire pour faire une demande de prêt.');
  }
}
