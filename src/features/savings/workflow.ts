export const SAVINGS_CHANGED = "creditfast:savings-changed";
export const OPEN_SAVINGS = "creditfast:open-savings-membership";
export type LoanIntent = {
  amount?: number | string;
  duration?: number | string;
  purpose?: string;
  income?: number;
  expenses?: number;
};
export type SavingsDraft = {
  clientType: string;
  fields: Record<string, string>;
  membershipId?: number;
  savedAt: string;
};
export const membershipStatusLabel = (status?: string) =>
  ({
    PENDING: "En attente",
    APPROVED: "Validée",
    REJECTED: "Refusée",
    CHANGES_REQUESTED: "À compléter",
  })[status ?? ""] ?? "Non renseigné";
function key(owner: string, kind: string) {
  return `creditfast:savings:${owner}:${kind}`;
}
export function readSavingsSession<T>(owner: string, kind: string): T | null {
  try {
    return JSON.parse(
      sessionStorage.getItem(key(owner, kind)) ?? "null",
    ) as T | null;
  } catch {
    return null;
  }
}
export function writeSavingsSession(
  owner: string,
  kind: string,
  value: unknown,
) {
  sessionStorage.setItem(key(owner, kind), JSON.stringify(value));
}
export function clearSavingsSession(owner: string, kind: string) {
  sessionStorage.removeItem(key(owner, kind));
}
