import { apiBlob, apiJson } from "./client";
import { unwrapCollection } from "./admin";
import { isApiError } from "./errors";
import type { ApiUser } from "./types";
import { isActiveSavingsAccount } from "@/features/savings/accountPolicy";

export type FinancialAccount = {
  id?: number;
  account_number?: string;
  account_type?: string;
  balance?: number;
  available_balance?: number;
  blocked_balance?: number;
  status?: string;
  opened_at?: string;
  holder_name?: string;
  caisse_name?: string;
  guichet_name?: string;
  agency_code?: string;
};

export type SavingsHistory = {
  id?: number;
  account_id?: number;
  closing_balance?: number;
  average_balance?: number;
  total_deposits?: number;
  total_withdrawals?: number;
  deposit_count?: number;
  withdrawal_count?: number;
  period_start?: string;
  period_end?: string;
};

export type ClientProfile = {
  id?: number;
  client_number?: string;
  client_type?: "PHYSICAL_PERSON" | "LEGAL_ENTITY" | string | null;
  company_name?: string | null;
  trade_name?: string | null;
  registration_number?: string | null;
  legal_form?: string | null;
  kyc_status?: string;
  city?: string | null;
  agency_code?: string | null;
  residential_zone?: string | null;
  occupation?: string | null;
  address?: string | null;
  user?: ApiUser;
  financial_accounts?: FinancialAccount[];
  savings_histories?: SavingsHistory[];
  savings_history?: SavingsHistory[];
};

export type KycDocument = {
  id: number;
  document_type?: string;
  original_filename?: string;
  status?: string;
  expires_at?: string | null;
  uploaded_at?: string;
};

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function asAccounts(value: unknown): FinancialAccount[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => {
    const row =
      item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    return {
      id: asNumber(row.id),
      account_number:
        typeof row.account_number === "string" ? row.account_number : undefined,
      account_type:
        typeof row.account_type === "string" ? row.account_type : undefined,
      balance: asNumber(row.balance),
      available_balance: asNumber(row.available_balance),
      blocked_balance: asNumber(row.blocked_balance),
      status: typeof row.status === "string" ? row.status : undefined,
      opened_at: typeof row.opened_at === "string" ? row.opened_at : undefined,
      holder_name: typeof row.holder_name === 'string' ? row.holder_name : undefined,
      caisse_name: typeof row.caisse_name === 'string' ? row.caisse_name : undefined,
      guichet_name: typeof row.guichet_name === 'string' ? row.guichet_name : undefined,
      agency_code: typeof row.agency_code === 'string' ? row.agency_code : undefined,
    };
  });
}

export function asHistories(value: unknown): SavingsHistory[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => {
    const row =
      item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    return {
      id: asNumber(row.id),
      account_id: asNumber(row.account_id),
      closing_balance: asNumber(row.closing_balance),
      average_balance: asNumber(row.average_balance),
      total_deposits: asNumber(row.total_deposits),
      total_withdrawals: asNumber(row.total_withdrawals),
      deposit_count: asNumber(row.deposit_count),
      withdrawal_count: asNumber(row.withdrawal_count),
      period_start:
        typeof row.period_start === "string" ? row.period_start : undefined,
      period_end:
        typeof row.period_end === "string" ? row.period_end : undefined,
    };
  });
}

export async function fetchClientProfile(): Promise<ClientProfile | null> {
  const payload = await apiJson<unknown>("/profile");
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const record = payload as Record<string, unknown>;
  const nested =
    record.client && typeof record.client === "object"
      ? (record.client as Record<string, unknown>)
      : record;
  const client = nested as ClientProfile;
  return {
    ...client,
    financial_accounts: asAccounts(
      nested.financial_accounts ?? record.financial_accounts,
    ),
    savings_histories: asHistories(
      nested.savings_histories ??
        nested.savings_history ??
        record.savings_histories ??
        record.savings_history,
    ),
  };
}

export function savingsBalanceFromProfile(profile: ClientProfile | null) {
  const accounts = profile?.financial_accounts ?? [];
  const epargne = accounts.filter((row) => {
    const type = (row.account_type || "").toUpperCase();
    return type.includes("EPARGNE") || type.includes("SAVING");
  });
  const pool = epargne.length ? epargne : accounts;
  const sum = pool.reduce((total, row) => total + (row.balance ?? 0), 0);
  if (sum > 0) {
    return sum;
  }
  const histories = profile?.savings_histories?.length
    ? profile.savings_histories
    : (profile?.savings_history ?? []);
  const latest = [...histories].sort((a, b) =>
    String(b.period_end ?? "").localeCompare(String(a.period_end ?? "")),
  )[0];
  return latest?.closing_balance ?? latest?.average_balance;
}

export function hasActiveSavingsAccount(profile: ClientProfile | null) {
  const accounts = profile?.financial_accounts ?? [];
  return accounts.some(isActiveSavingsAccount);
}

export async function fetchKycDocumentFile(documentId: number) {
  return apiBlob(`/kyc-documents/${documentId}/file`);
}

export type FinancialProfile = {
  monthly_income?: number;
  other_income?: number;
  monthly_expenses?: number;
  existing_debt_payment?: number;
  dependents_count?: number;
};

export type StoreFinancialProfilePayload = {
  monthly_income: number;
  monthly_expenses: number;
  other_income?: number | null;
  existing_debt_payment?: number | null;
  dependents_count?: number | null;
};

export type UpdateClientProfilePayload = {
  date_of_birth?: string | null;
  address?: string | null;
  city?: string | null;
  residential_zone?: string | null;
  occupation?: string | null;
};

export type EconomicActivity = {
  id: number;
  activity_type?: string;
  sector?: string | null;
  description?: string | null;
  start_date?: string | null;
  location?: string | null;
  monthly_revenue?: number;
};

export type StoreActivityPayload = {
  activity_type: string;
  monthly_revenue: number;
  sector?: string | null;
  description?: string | null;
  start_date?: string | null;
  location?: string | null;
};

export const KYC_IDENTITY_TYPES = [
  "CNI",
  "PASSEPORT",
  "PIECE_IDENTITE",
] as const;

export function isKycIdentityType(value?: string) {
  const key = (value || "").toUpperCase();
  return (
    KYC_IDENTITY_TYPES.includes(key as (typeof KYC_IDENTITY_TYPES)[number]) ||
    key === "NINA"
  );
}

export function hasRequiredIdentityDocument(documents: KycDocument[]) {
  return documents.some(doc =>
    isKycIdentityType(doc.document_type) &&
    !['REJECTED', 'INVALID', 'EXPIRED', 'FAILED', 'ERROR'].includes((doc.status ?? '').toUpperCase()) &&
    (!doc.expires_at || new Date(doc.expires_at).getTime() > Date.now()),
  );
}

function unwrapObject(
  payload: unknown,
  keys: string[],
): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const record = payload as Record<string, unknown>;
  for (const key of keys) {
    if (
      record[key] &&
      typeof record[key] === "object" &&
      !Array.isArray(record[key])
    ) {
      return record[key] as Record<string, unknown>;
    }
  }
  return record;
}

function unwrapActivity(payload: unknown): EconomicActivity | null {
  const nested = unwrapObject(payload, [
    "activity",
    "economic_activity",
    "data",
  ]);
  const id = nested ? asNumber(nested.id) : undefined;
  if (!nested || id == null) {
    return null;
  }
  return {
    id,
    activity_type:
      typeof nested.activity_type === "string"
        ? nested.activity_type
        : undefined,
    sector: typeof nested.sector === "string" ? nested.sector : null,
    description:
      typeof nested.description === "string" ? nested.description : null,
    start_date:
      typeof nested.start_date === "string" ? nested.start_date : null,
    location: typeof nested.location === "string" ? nested.location : null,
    monthly_revenue: asNumber(nested.monthly_revenue),
  };
}

export async function updateClientProfile(body: UpdateClientProfilePayload) {
  const payload = await apiJson<unknown>("/profile", {
    method: "PUT",
    body: JSON.stringify(body),
  });
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const record = payload as Record<string, unknown>;
  const nested =
    record.client && typeof record.client === "object"
      ? (record.client as ClientProfile)
      : (payload as ClientProfile);
  return nested;
}

export async function fetchAccountCheck(): Promise<FinancialProfile | null> {
  let payload: unknown;
  try {
    payload = await apiJson<unknown>("/profile/account-check");
  } catch (error) {
    if (isApiError(error) && error.status === 404) {
      return null;
    }
    throw error;
  }
  const nested = unwrapObject(payload, ["account_check", "data"]) ?? (payload && typeof payload === "object" ? payload as Record<string, unknown> : null);
  if (!nested) {
    return null;
  }
  return {
    monthly_income: asNumber(nested.monthly_income),
    monthly_expenses: asNumber(nested.monthly_expenses),
    existing_debt_payment: asNumber(nested.existing_debt_payment),
  };
}

export async function fetchFinancialProfile(): Promise<FinancialProfile | null> {
  let payload: unknown;
  try {
    payload = await apiJson<unknown>("/profile/financial-profile");
  } catch (error) {
    if (isApiError(error) && error.status === 404) {
      return null;
    }
    throw error;
  }
  const nested = unwrapObject(payload, ["financial_profile", "data"]);
  if (!nested) {
    return null;
  }
  return {
    monthly_income: asNumber(nested.monthly_income),
    other_income: asNumber(nested.other_income),
    monthly_expenses: asNumber(nested.monthly_expenses),
    existing_debt_payment: asNumber(nested.existing_debt_payment),
    dependents_count: asNumber(nested.dependents_count),
  };
}

export async function saveFinancialProfile(body: StoreFinancialProfilePayload) {
  try {
    await apiJson<unknown>("/profile/financial-profile", {
      method: "PUT",
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (!isApiError(error) || error.status !== 404) {
      throw error;
    }
    await apiJson<unknown>("/profile/financial-profile", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }
}

export async function listEconomicActivities() {
  const payload = await apiJson<unknown>("/profile/activities");
  return unwrapCollection<EconomicActivity>(payload)
    .map((row) => unwrapActivity(row) ?? row)
    .filter((row) => typeof row.id === "number");
}

export async function getEconomicActivity(activityId: number) {
  const payload = await apiJson<unknown>(`/profile/activities/${activityId}`);
  return unwrapActivity(payload);
}

export async function saveEconomicActivity(
  body: StoreActivityPayload,
  activityId?: number,
) {
  const payload = activityId
    ? await apiJson<unknown>(`/profile/activities/${activityId}`, {
        method: "PUT",
        body: JSON.stringify(body),
      })
    : await apiJson<unknown>("/profile/activities", {
        method: "POST",
        body: JSON.stringify(body),
      });
  return unwrapActivity(payload);
}

export async function deleteEconomicActivity(activityId: number) {
  return apiJson<unknown>(`/profile/activities/${activityId}`, {
    method: "DELETE",
  });
}

export async function listKycDocuments() {
  const payload = await apiJson<unknown>("/profile/kyc-documents");
  return unwrapCollection<KycDocument>(payload);
}

export async function getKycDocument(
  documentId: number,
): Promise<KycDocument | null> {
  const payload = await apiJson<unknown>(
    `/profile/kyc-documents/${documentId}`,
  );
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const record = payload as Record<string, unknown>;
  const nested =
    (record.kyc_document && typeof record.kyc_document === "object"
      ? (record.kyc_document as Record<string, unknown>)
      : null) ||
    (record.document && typeof record.document === "object"
      ? (record.document as Record<string, unknown>)
      : null) ||
    (record.data &&
    typeof record.data === "object" &&
    !Array.isArray(record.data)
      ? (record.data as Record<string, unknown>)
      : null) ||
    record;
  const id = asNumber(nested.id);
  if (id == null) {
    return null;
  }
  return {
    id,
    document_type:
      typeof nested.document_type === "string"
        ? nested.document_type
        : undefined,
    original_filename:
      typeof nested.original_filename === "string"
        ? nested.original_filename
        : undefined,
    status: typeof nested.status === "string" ? nested.status : undefined,
    expires_at:
      typeof nested.expires_at === "string" ? nested.expires_at : null,
    uploaded_at:
      typeof nested.uploaded_at === "string" ? nested.uploaded_at : undefined,
  };
}

/** Retrait possible uniquement tant que l’agent n’a pas contrôlé la pièce. */
export function isKycDocumentRemovable(status?: string) {
  return !["VERIFIED", "REJECTED"].includes((status || "").toUpperCase());
}

export async function deleteKycDocument(documentId: number) {
  return apiJson<unknown>(`/profile/kyc-documents/${documentId}`, {
    method: "DELETE",
  });
}

export async function uploadKycDocument(
  file: File,
  documentType: string,
  documentNumber?: string,
) {
  const form = new FormData();
  form.append(
    "document_type",
    documentType === "NINA" ? "PIECE_IDENTITE" : documentType,
  );
  form.append("file", file);
  if (documentNumber?.trim()) {
    form.append("document_number", documentNumber.trim());
  }
  return apiJson<unknown>("/profile/kyc-documents", {
    method: "POST",
    body: form,
  });
}

export async function fetchProfilePhotoMeta() {
  const payload = await apiJson<unknown>("/profile-photo");
  if (!payload || typeof payload !== "object") {
    return {
      has_photo: false as boolean,
      profile_photo_url: null as string | null,
    };
  }
  const record = payload as Record<string, unknown>;
  return {
    has_photo: Boolean(record.has_photo),
    profile_photo_url:
      typeof record.profile_photo_url === "string"
        ? record.profile_photo_url
        : null,
  };
}

export async function fetchUserPhotoFile(userId: number) {
  return apiBlob(`/users/${userId}/photo/file`);
}

export async function deleteProfilePhoto() {
  return apiJson<unknown>("/profile-photo", { method: "DELETE" });
}

export async function uploadProfilePhoto(file: File, replaceExisting: boolean) {
  const form = new FormData();
  form.append("photo", file);
  try {
    return await apiJson<unknown>("/profile-photo", {
      method: replaceExisting ? "PUT" : "POST",
      body: form,
    });
  } catch (error) {
    if (
      !replaceExisting &&
      isApiError(error) &&
      (error.status === 409 || error.status === 422)
    ) {
      const retry = new FormData();
      retry.append("photo", file);
      return apiJson<unknown>("/profile-photo", {
        method: "PUT",
        body: retry,
      });
    }
    throw error;
  }
}
