import { apiJson } from "./client";
import { unwrapCollection } from "./admin";
import { fetchClientProfile, hasActiveSavingsAccount, hasRequiredIdentityDocument, listKycDocuments } from "./profile";
import { isApiError } from "./errors";

export type Membership = {
  id: number;
  client_type: "PHYSICAL_PERSON" | "LEGAL_ENTITY";
  status: "PENDING" | "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";
  applicant_name: string;
  rejection_reason?: string;
  correction_reason?: string;
  created_at?: string;
  reviewed_at?: string;
  reviewed_by?: string;
  fields: Record<string, string>;
  documents: { id: number; key?: string; label: string; filename: string }[];
};

export type BankAccountApplicationType = "physical-person" | "legal-entity";

export type Caisse = { id: number; name?: string; label?: string };
export type SavingsTransaction = {
  id: number;
  reference: string;
  booked_at: string;
  label: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER' | 'FEE' | 'INTEREST';
  direction: 'CREDIT' | 'DEBIT';
  amount: number;
  status: 'COMPLETED' | 'PENDING' | 'CANCELLED';
  balance_after?: number;
  channel?: string;
};

export async function listSavingsTransactions(accountId: number) {
  return unwrapCollection<SavingsTransaction>(await apiJson<unknown>(`/profile/financial-accounts/${accountId}/transactions`));
}
export type Guichet = { id: number; name?: string; label?: string };

export async function listCaisses() {
  return unwrapCollection<Caisse>(await apiJson<unknown>("/caisses"));
}

export async function listGuichets(caisseId: number) {
  return unwrapCollection<Guichet>(
    await apiJson<unknown>(`/caisses/${caisseId}/guichets`),
  );
}

function applicationType(
  clientType?: string | null,
): BankAccountApplicationType {
  return clientType === "LEGAL_ENTITY" ? "legal-entity" : "physical-person";
}

function applicationBase(type: BankAccountApplicationType) {
  return `/bank-account-applications/${type}`;
}

export function listAgentBankAccountApplications(
  type: BankAccountApplicationType,
  status?: string,
) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiJson<unknown>(`/agent${applicationBase(type)}${query}`).then(
    (payload) => unwrapCollection<Membership>(payload),
  );
}

export function getAgentBankAccountApplication(
  type: BankAccountApplicationType,
  id: number,
) {
  return apiJson<unknown>(`/agent${applicationBase(type)}/${id}`);
}

export function returnAgentBankAccountApplication(
  type: BankAccountApplicationType,
  id: number,
  reason: string,
) {
  return apiJson(`/agent${applicationBase(type)}/${id}/return`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function rejectAgentBankAccountApplication(
  type: BankAccountApplicationType,
  id: number,
  reason: string,
) {
  return apiJson(`/agent${applicationBase(type)}/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function approveAgentBankAccountApplication(
  type: BankAccountApplicationType,
  id: number,
  body: { account_number?: string; caisse_signature?: string } = {},
) {
  return apiJson(`/agent${applicationBase(type)}/${id}/approve`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// Contract documented in docs/savings-api.md; the server owns approval and account creation.
export async function getMembership(
  clientType?: string | null,
): Promise<Membership | null> {
  const profile = clientType === undefined ? await fetchClientProfile() : null;

  const type = applicationType(clientType ?? profile?.client_type);

  try {
    const result = await apiJson<unknown>(applicationBase(type));

    const listed = unwrapCollection<Membership>(result)
      .filter((item) => item && typeof item === "object")
      .sort((left, right) =>
        String(right.created_at ?? "").localeCompare(
          String(left.created_at ?? ""),
        ),
      );

    // Collection contenant une adhésion
    if (listed.length > 0) {
      const membership = listed[0];

      if (
        !membership.id ||
        ![
          "DRAFT",
          "PENDING",
          "APPROVED",
          "REJECTED",
          "CHANGES_REQUESTED",
          "RETURNED",
        ].includes(membership.status)
      ) {
        throw new Error(
          "Le statut de votre adhésion n’a pas pu être vérifié. Réessayez.",
        );
      }

      return membership;
    }

    // Réponse objet éventuelle
    if (result && typeof result === "object" && !Array.isArray(result)) {
      const record = result as Record<string, unknown>;

      const candidate =
        record.application ??
        record.bank_account_application ??
        record.membership;

      // data seulement s'il s'agit d'un objet et non d'un tableau
      const data =
        record.data &&
        typeof record.data === "object" &&
        !Array.isArray(record.data)
          ? record.data
          : null;

      const membership = (candidate ?? data) as Membership | null;

      if (membership?.id) {
        if (
          ![
            "DRAFT",
            "PENDING",
            "APPROVED",
            "REJECTED",
            "CHANGES_REQUESTED",
            "RETURNED",
          ].includes(membership.status)
        ) {
          throw new Error(
            "Le statut de votre adhésion n’a pas pu être vérifié. Réessayez.",
          );
        }

        return membership;
      }
    }

    // IMPORTANT :
    // [] ou { data: [] } ou absence d'application
    // = aucune adhésion
    // = afficher le formulaire de création
    return null;
  } catch (error) {
    if (isApiError(error) && error.status === 404) {
      return null;
    }

    throw error;
  }
}
// export async function getMembership(
//   clientType?: string | null,
// ): Promise<Membership | null> {
//   const profile = clientType === undefined ? await fetchClientProfile() : null;
//   const result = await apiJson<unknown>(
//     applicationBase(applicationType(clientType ?? profile?.client_type)),
//   );
//   const listed = unwrapCollection<Membership>(result).sort((left, right) =>
//     String(right.created_at ?? "").localeCompare(String(left.created_at ?? "")),
//   );
//   const record =
//     result && typeof result === "object"
//       ? (result as Record<string, unknown>)
//       : {};
//   const membership = (listed[0] ??
//     record.data ??
//     record.application ??
//     record.bank_account_application ??
//     record.membership ??
//     null) as Membership | null;
//   if (
//     membership !== null &&
//     (!membership?.id ||
//       ![
//         "DRAFT",
//         "PENDING",
//         "APPROVED",
//         "REJECTED",
//         "CHANGES_REQUESTED",
//         "RETURNED",
//       ].includes(membership.status))
//   ) {
//     throw new Error(
//       "Le statut de votre adhésion n’a pas pu être vérifié. Réessayez.",
//     );
//   }
//   return membership;
// }

// export async function createMembership(
//   body: FormData,
//   membershipId?: number,
//   clientType?: string | null,
// ) {
//   const profile = clientType === undefined ? await fetchClientProfile() : null;
//   const path = membershipId
//     ? `${applicationBase(applicationType(clientType ?? profile?.client_type))}/${membershipId}`
//     : applicationBase(applicationType(clientType ?? profile?.client_type));
//   const result = await apiJson<unknown>(path, {
//     method: membershipId ? "PUT" : "POST",
//     body,
//   });
//   const record =
//     result && typeof result === "object"
//       ? (result as Record<string, unknown>)
//       : {};
//   const membership = (record.data ??
//     record.application ??
//     record.bank_account_application ??
//     record.membership) as Membership;
//   if (!membership?.id) {
//     throw new Error(
//       "La mise en attente de votre adhésion n’a pas été confirmée. Actualisez son statut avant de réessayer.",
//     );
//   }
//   const submitted = await apiJson<unknown>(`${path}/${membership.id}/submit`, {
//     method: "POST",
//   });
//   const submittedRecord =
//     submitted && typeof submitted === "object"
//       ? (submitted as Record<string, unknown>)
//       : {};
//   return (submittedRecord.data ??
//     submittedRecord.application ??
//     submittedRecord.bank_account_application ??
//     submittedRecord.membership ??
//     membership) as Membership;
// }
export async function createMembership(
  body: FormData,
  membershipId?: number,
  clientType?: string | null,
) {
  const profile = clientType === undefined ? await fetchClientProfile() : null;

  const type = applicationType(clientType ?? profile?.client_type);

  const base = applicationBase(type);

  const path = membershipId ? `${base}/${membershipId}` : base;

  const result = await apiJson<unknown>(path, {
    method: membershipId ? "PUT" : "POST",
    body,
  });

  const record =
    result && typeof result === "object"
      ? (result as Record<string, unknown>)
      : {};

  const membership = (record.data ??
    record.application ??
    record.bank_account_application ??
    record.membership) as Membership;

  if (!membership?.id) {
    throw new Error("La création de votre adhésion n’a pas été confirmée.");
  }

  // IMPORTANT : repartir de base, pas de path
  const submitted = await apiJson<unknown>(`${base}/${membership.id}/submit`, {
    method: "POST",
  });

  const submittedRecord =
    submitted && typeof submitted === "object"
      ? (submitted as Record<string, unknown>)
      : {};

  return (submittedRecord.data ??
    submittedRecord.application ??
    submittedRecord.bank_account_application ??
    submittedRecord.membership ??
    membership) as Membership;
}

export async function listPendingMemberships(status = "PENDING") {
  const [physical, legal] = await Promise.all([
    listAgentBankAccountApplications(
      "physical-person",
      status === "ALL" ? undefined : status,
    ),
    listAgentBankAccountApplications(
      "legal-entity",
      status === "ALL" ? undefined : status,
    ),
  ]);
  return [...physical, ...legal];
}

export function reviewMembership(
  id: number,
  clientType: string | undefined,
  body: {
    decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";
    account_number?: string;
    caisse_signature?: string;
    rejection_reason?: string;
    correction_reason?: string;
  },
) {
  const type = applicationType(clientType);
  const action =
    body.decision === "APPROVED"
      ? "approve"
      : body.decision === "REJECTED"
        ? "reject"
        : "return";
  const payload =
    body.decision === "APPROVED"
      ? {
          account_number: body.account_number,
          caisse_signature: body.caisse_signature,
        }
      : { reason: body.rejection_reason ?? body.correction_reason };
  return apiJson(`${applicationBase(type)}/${id}/${action}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function requireActiveSavingsAccount() {
  if (!hasActiveSavingsAccount(await fetchClientProfile())) {
    throw new Error(
      "Un compte épargne actif, validé par l’administrateur, est nécessaire pour faire une demande de prêt.",
    );
  }
  if (!hasRequiredIdentityDocument(await listKycDocuments())) {
    throw new Error('Complétez votre profil CreditFast avec une pièce d’identité avant de demander un prêt.');
  }
}
