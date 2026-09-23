import {
  addCreditGuarantee,
  createCreditRequest,
  getClientSubmitBlockers,
  getCreditRequest,
  guaranteeHasFile,
  listCreditRequestGuarantees,
  submitCreditRequest,
  updateCreditRequest,
  updateCreditGuarantee,
  uploadCreditDocument,
  type GuaranteeInput,
  type StoreCreditRequestPayload,
} from "@/api/credit";
import { persistWizardFiche } from "./persistFiche";

export function mapGuaranteeType(raw: string) {
  const key = raw.toUpperCase();
  if (key.includes("CAUTION")) {
    return "CAUTION";
  }
  if (
    key.includes("PARCELLE") ||
    key.includes("FONCIER") ||
    key.includes("TERRAIN")
  ) {
    return "FONCIER";
  }
  if (
    key.includes("STOCK") ||
    key.includes("BOUTIQUE") ||
    key.includes("MARCHAND")
  ) {
    return "BOUTIQUE";
  }
  if (key.includes("EPARGNE")) {
    return "EPARGNE";
  }
  return "MATERIEL";
}

function fieldValue(id: string) {
  return String(
    (
      document.getElementById(id) as
        | HTMLInputElement
        | HTMLTextAreaElement
        | HTMLSelectElement
        | null
    )?.value ?? "",
  ).trim();
}

function fieldNumber(id: string) {
  const value = Number(fieldValue(id).replace(/\s/g, ""));
  return Number.isFinite(value) ? value : 0;
}

function readWizardRequest(activityId?: number): StoreCreditRequestPayload {
  const guaranteeType = fieldValue("wiz-guarantee-type");
  const guaranteeValue = fieldNumber("wiz-guarantee-val");
  return {
    credit_type: fieldValue("wiz-credit-type"),
    requested_amount: fieldNumber("wiz-amount") || 0,
    duration_months: fieldNumber("wiz-duration") || 6,
    purpose: fieldValue("wiz-purpose") || "Demande de prêt",
    declared_monthly_income: fieldNumber("wiz-income") || 0,
    declared_monthly_expenses: fieldNumber("wiz-expenses") || 0,
    activity_id: activityId,
    guarantee: guaranteeType
      ? {
          guarantee_type: mapGuaranteeType(guaranteeType),
          declared_value: guaranteeValue,
          description: fieldValue("wiz-guarantee-desc") || undefined,
        }
      : undefined,
  };
}

function wizardFile() {
  const fileInput = document.getElementById(
    "wiz-doc-file",
  ) as HTMLInputElement | null;
  return {
    file: fileInput?.files?.[0] ?? null,
    documentType: fieldValue("wiz-doc-type") || "PREUVE_REVENU",
  };
}

function wizardGuaranteeFile() {
  const fileInput = document.getElementById(
    "wiz-guarantee-file",
  ) as HTMLInputElement | null;
  return fileInput?.files?.[0] ?? null;
}

function requestWithoutGuarantee(
  request: StoreCreditRequestPayload,
): StoreCreditRequestPayload {
  const { guarantee: _guarantee, ...body } = request;
  return body;
}

async function upsertGuarantee(
  requestId: number,
  guarantee?: GuaranteeInput,
  file?: File | null,
) {
  if (!guarantee?.guarantee_type || !(guarantee.declared_value > 0)) {
    return;
  }
  const existing = await listCreditRequestGuarantees(requestId).catch(() => []);
  const sameType = existing.find(
    (item) =>
      (item.guarantee_type || "").toUpperCase() ===
      guarantee.guarantee_type.toUpperCase(),
  );
  const current = sameType ?? existing[0];
  if (current?.id) {
    await updateCreditGuarantee(requestId, current.id, guarantee, file);
    return;
  }
  await addCreditGuarantee(requestId, guarantee, file);
}

async function hasExistingGuaranteeFile(
  requestId: number,
  guarantee?: GuaranteeInput,
) {
  if (!guarantee?.guarantee_type) {
    return false;
  }
  const existing = await listCreditRequestGuarantees(requestId).catch(() => []);
  const sameType = existing.find(
    (item) =>
      (item.guarantee_type || "").toUpperCase() ===
      guarantee.guarantee_type.toUpperCase(),
  );
  return guaranteeHasFile(sameType);
}

async function upsertRequest(
  request: StoreCreditRequestPayload,
  draftId?: number,
  guaranteeFile?: File | null,
) {
  const body = requestWithoutGuarantee(request);
  if (draftId) {
    const updated = await updateCreditRequest(draftId, {
      credit_type: body.credit_type,
      requested_amount: body.requested_amount,
      duration_months: body.duration_months,
      purpose: body.purpose,
      declared_monthly_income: body.declared_monthly_income,
      declared_monthly_expenses: body.declared_monthly_expenses,
      activity_id: body.activity_id ?? null,
    });
    await upsertGuarantee(updated.id, request.guarantee, guaranteeFile);
    return updated;
  }
  const created = await createCreditRequest(body);
  await upsertGuarantee(created.id, request.guarantee, guaranteeFile);
  return created;
}

export async function saveDraftLoanApplication() {
  const { activityId } = await persistWizardFiche();
  const request = readWizardRequest(activityId);
  if (request.requested_amount < 10000) {
    throw new Error(
      "Indiquez un montant d’au moins 10 000 FCFA pour enregistrer le brouillon.",
    );
  }
  if (!request.credit_type) {
    throw new Error(
      "Choisissez un type de crédit compatible avant d’enregistrer le dossier.",
    );
  }
  const draftId = Number(fieldValue("wiz-draft-id")) || undefined;
  const guaranteeFile = wizardGuaranteeFile();
  const saved = await upsertRequest(
    {
      ...request,
      guarantee:
        request.guarantee?.guarantee_type &&
        request.guarantee.declared_value > 0
          ? request.guarantee
          : undefined,
    },
    draftId,
    guaranteeFile,
  );
  const { file, documentType } = wizardFile();
  if (file) {
    try {
      await uploadCreditDocument(saved.id, file, documentType);
    } catch {
      throw new Error(
        "Brouillon enregistré, mais la pièce n’a pas pu être jointe. Ajoutez-la depuis Mes pièces.",
      );
    }
  }
  const draftField = document.getElementById(
    "wiz-draft-id",
  ) as HTMLInputElement | null;
  if (draftField) {
    draftField.value = String(saved.id);
  }
  return saved;
}

export async function submitCompleteLoanApplication(input?: {
  request?: StoreCreditRequestPayload;
  file?: File | null;
  documentType?: string;
}) {
  const { activityId } = await persistWizardFiche();
  const request = input?.request ?? readWizardRequest(activityId);
  if (activityId && !request.activity_id) {
    request.activity_id = activityId;
  }
  if (!request.credit_type) {
    throw new Error(
      "Choisissez un type de crédit compatible avant d’envoyer le dossier à l’agent.",
    );
  }
  if (
    !request.guarantee?.guarantee_type ||
    !(request.guarantee.declared_value > 0)
  ) {
    throw new Error(
      "Déclarez une garantie (type et valeur) avant d’envoyer le dossier à l’agent.",
    );
  }
  const draftId = Number(fieldValue("wiz-draft-id")) || undefined;
  const guaranteeFile = wizardGuaranteeFile();
  const existingGuaranteeFile = draftId
    ? await hasExistingGuaranteeFile(draftId, request.guarantee)
    : false;
  if (!guaranteeFile && !existingGuaranteeFile) {
    throw new Error(
      "Joignez le justificatif de garantie avant d’envoyer le dossier à l’agent.",
    );
  }
  const { file, documentType } =
    input?.file !== undefined
      ? {
          file: input.file,
          documentType: input.documentType || "PREUVE_REVENU",
        }
      : wizardFile();
  if (!file) {
    throw new Error(
      "Joignez au moins une pièce justificative avant d’envoyer le dossier à l’agent.",
    );
  }

  const created = await upsertRequest(request, draftId, guaranteeFile);
  try {
    await uploadCreditDocument(created.id, file, documentType);
  } catch {
    throw new Error(
      "La pièce n’a pas pu être jointe. Le dossier reste en brouillon : ajoutez un fichier puis renvoyez.",
    );
  }

  const { blockers } = await getClientSubmitBlockers(created.id);
  if (blockers.length) {
    throw new Error(
      `Envoi impossible : ${blockers.join(" et ")} manquant${blockers.length > 1 ? "s" : ""}.`,
    );
  }

  await submitCreditRequest(created.id);
  return created;
}

export async function completeAndResubmit(
  id: number,
  file?: File | null,
  documentType?: string,
) {
  if (file) {
    await uploadCreditDocument(id, file, documentType || "PREUVE_REVENU");
  }
  const { blockers } = await getClientSubmitBlockers(id);
  if (blockers.length) {
    throw new Error(`Encore manquant : ${blockers.join(" et ")}.`);
  }
  return submitCreditRequest(id);
}

export async function loadDraftForWizard(id: number) {
  return getCreditRequest(id);
}
