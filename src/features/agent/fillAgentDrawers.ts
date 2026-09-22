import { toast } from '@heroui/react';
import {
  getCreditGuarantee,
  getCreditRequest,
  guaranteeHasFile,
  listAgentRequests,
  listCreditRequestDocuments,
  listCreditRequestGuarantees,
  loadCreditAnalysis,
  requestComplements,
  verifyGuarantee,
  submitAnalystReview,
  submitHumanValidation,
  resolveAnomaly,
  type CreditAnalysis,
  type CreditDocument,
  type CreditGuarantee,
  type CreditRequest,
} from '@/api/credit';
import { getAgentClient, listAgentClientKycDocuments, verifyKycDocument, agentClientName, type AgentClient } from '@/api/agent';
import { listNotifications, notificationTypeLabel, type AppNotification } from '@/api/notifications';
import type { KycDocument } from '@/api/profile';
import { isApiError } from '@/api/errors';
import { getUiSession } from '@/app/session';
import { documentCheck, identityCheck, isDocumentRejected } from '@/features/workflow/compliance';
import { borrowerName, creditStatusLabel, formatDate, formatFcfa, getSelectedCreditRequestId, notifyRequestsChanged, setSelectedCreditRequestId } from '@/features/workflow/workflow';

function setText(id: string, value: string) {
  const node = document.getElementById(id);
  if (node) {
    node.textContent = value;
  }
}

function setHtml(id: string, value: string) {
  const node = document.getElementById(id);
  if (node) {
    node.innerHTML = value;
  }
}

function showBackdrop(id: string, visible = true) {
  const modal = document.getElementById(id);
  if (!modal) {
    return;
  }
  if (!visible) {
    modal.classList.remove('active');
    modal.style.display = 'none';
    return;
  }
  modal.style.display = 'flex';
  window.requestAnimationFrame(() => modal.classList.add('active'));
}

function dash(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || '—';
}

function phoneHref(phone?: string | null, scheme: 'tel' | 'sms' = 'tel') {
  const digits = (phone || '').replace(/[^\d+]/g, '');
  return digits ? `${scheme}:${digits}` : null;
}

function bindHrefButton(id: string, href: string | null, emptyMessage: string) {
  const button = document.getElementById(id) as HTMLButtonElement | null;
  if (!button) {
    return;
  }
  button.onclick = (event) => {
    event.preventDefault();
    if (!href) {
      toast.info(emptyMessage);
      return;
    }
    window.location.href = href;
  };
}

function scoringLabel(recommendation?: string) {
  const key = (recommendation || '').toUpperCase();
  if (key === 'FAVORABLE') {
    return 'Avis favorable';
  }
  if (key === 'RESERVED') {
    return 'Avis réservé';
  }
  if (key === 'UNFAVORABLE') {
    return 'Avis défavorable';
  }
  return recommendation ? recommendation : 'Non calculé';
}

function formatScore(value?: number) {
  if (value == null || Number.isNaN(value)) {
    return null;
  }
  return Math.round(value <= 1 ? value * 100 : value);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

type DecisionState = 'ok' | 'warn' | 'bad';

type DecisionCheckItem = {
  label: string;
  detail: string;
  state: DecisionState;
};

type TimelineState = 'done' | 'active' | 'todo';

type TimelineStep = {
  label: string;
  detail: string;
  state: TimelineState;
  date?: string | null;
};

function checkIcon(state: DecisionState) {
  if (state === 'ok') {
    return 'fa-check';
  }
  if (state === 'bad') {
    return 'fa-xmark';
  }
  return 'fa-exclamation';
}

function renderDecisionChecklist(items: DecisionCheckItem[]) {
  return items
    .map(
      (item) => `<div class="decision-check-item is-${item.state}">
        <span class="decision-check-icon"><i class="fas ${checkIcon(item.state)}"></i></span>
        <span>
          <span class="decision-check-title">${escapeHtml(item.label)}</span>
          <span class="decision-check-detail">${escapeHtml(item.detail)}</span>
        </span>
      </div>`,
    )
    .join('');
}

function factorColor(score: number | null) {
  if (score == null) {
    return '#94a3b8';
  }
  if (score >= 70) {
    return '#518e45';
  }
  if (score >= 50) {
    return '#f1ca30';
  }
  return '#dc2626';
}

function renderDecisionFactors(factors: readonly (readonly [string, number | undefined])[]) {
  if (!factors.some(([, value]) => value != null)) {
    return '<p style="margin:0;font-size:0.74rem;color:var(--text-muted)">Sous-scores indisponibles tant que l’analyse n’est pas calculée.</p>';
  }
  return factors
    .map(([label, value]) => {
      const score = formatScore(value);
      const width = Math.max(0, Math.min(100, score ?? 0));
      const color = factorColor(score);
      return `<div class="decision-factor-row">
        <span>${escapeHtml(label)}</span>
        <span class="decision-factor-value">${score != null ? `${score}/100` : '—'}</span>
        <div class="decision-factor-track" style="grid-column:1 / -1">
          <div class="decision-factor-fill" style="width:${width}%;background:${color}"></div>
        </div>
      </div>`;
    })
    .join('');
}

function isVerifiedStatus(status?: string | null) {
  return ['VERIFIED', 'VALIDATED', 'APPROVED', 'CONFORME', 'ACCEPTED'].includes((status || '').toUpperCase());
}

function isRejectedStatus(status?: string | null) {
  return ['REJECTED', 'FAILED', 'INVALID', 'ERROR'].includes((status || '').toUpperCase());
}

function capacityIsSufficient(row: CreditRequest, disposable?: number) {
  const status = (row.repayment_capacity_status || '').toUpperCase();
  if (status === 'SUFFICIENT') {
    return true;
  }
  if (status === 'INSUFFICIENT') {
    return false;
  }
  return disposable != null && row.estimated_monthly_payment != null && disposable >= row.estimated_monthly_payment;
}

function buildDecisionChecks(input: {
  row: CreditRequest;
  docs: CreditDocument[];
  guarantees: CreditGuarantee[];
  identityDocs: KycDocument[];
  borrowerKyc?: string | null;
  disposable?: number;
}) {
  const { row, docs, guarantees, identityDocs, borrowerKyc, disposable } = input;
  const hasIdentity = identityDocs.length > 0 || Boolean(borrowerKyc);
  const kycVerified = identityDocs.some((doc) => isVerifiedStatus(doc.status)) || isVerifiedStatus(borrowerKyc);
  const kycRejected = identityDocs.some((doc) => isRejectedStatus(doc.status)) || isRejectedStatus(borrowerKyc);
  const docsRejected = docs.some((doc) => isRejectedStatus(doc.status));
  const docsAllRead = docs.length > 0 && docs.every((doc) => isVerifiedStatus(doc.status) || !['UPLOADED', 'PENDING'].includes((doc.status || 'UPLOADED').toUpperCase()));
  const guaranteeVerified = guarantees.some((item) => isVerifiedStatus(item.verification_status));
  const guaranteeRejected = guarantees.some((item) => isRejectedStatus(item.verification_status));
  const capacityOk = capacityIsSufficient(row, disposable);
  const capacityKnown = (row.repayment_capacity_status || '').trim() || (disposable != null && row.estimated_monthly_payment != null);

  const items: DecisionCheckItem[] = [
    {
      label: 'KYC emprunteur',
      detail: kycVerified
        ? 'Identité vérifiée pour l’instruction.'
        : kycRejected
          ? 'Identité rejetée ou non conforme.'
          : hasIdentity
            ? 'Identité déposée, validation agent attendue.'
            : 'Aucune pièce d’identité exploitable.',
      state: kycVerified ? 'ok' : kycRejected || !hasIdentity ? 'bad' : 'warn',
    },
    {
      label: 'Pièces justificatives',
      detail: docs.length
        ? docsRejected
          ? 'Au moins une pièce est non conforme.'
          : docsAllRead
            ? 'Pièces présentes et lisibles.'
            : 'Pièces présentes, lecture ou validation à finaliser.'
        : 'Aucune pièce de dossier jointe.',
      state: docs.length ? (docsRejected ? 'bad' : docsAllRead ? 'ok' : 'warn') : 'bad',
    },
    {
      label: 'Garantie',
      detail: guaranteeVerified
        ? 'Garantie vérifiée par le terrain.'
        : guaranteeRejected
          ? 'Garantie rejetée.'
          : guarantees.length
            ? 'Garantie déclarée, contrôle terrain requis.'
            : 'Aucune garantie déclarée.',
      state: guaranteeVerified ? 'ok' : guaranteeRejected || !guarantees.length ? 'bad' : 'warn',
    },
    {
      label: 'Capacité de remboursement',
      detail: capacityKnown
        ? capacityOk
          ? 'Mensualité compatible avec le reste à vivre.'
          : 'Mensualité trop élevée ou reste à vivre insuffisant.'
        : 'Capacité non calculée.',
      state: capacityKnown ? (capacityOk ? 'ok' : 'bad') : 'warn',
    },
  ];

  return {
    items,
    kycVerified,
    docsOk: docs.length > 0 && !docsRejected,
    guaranteeVerified,
    capacityOk: Boolean(capacityKnown && capacityOk),
    hasBlockingIssue: items.some((item) => item.state === 'bad'),
    hasWarning: items.some((item) => item.state === 'warn'),
  };
}

function nextActionForAgent(checks: ReturnType<typeof buildDecisionChecks>, analysis: CreditAnalysis | null) {
  if (checks.hasBlockingIssue) {
    return 'Demander des compléments';
  }
  if (!checks.kycVerified) {
    return 'Valider le KYC';
  }
  if (!checks.guaranteeVerified) {
    return 'Planifier le contrôle terrain';
  }
  if (!analysis) {
    return 'Lancer l’analyse 360°';
  }
  return 'Transmettre à l’analyste';
}

function nextActionForAnalyst(checks: ReturnType<typeof buildDecisionChecks>, signalCount: number, analysis: CreditAnalysis | null) {
  if (checks.hasBlockingIssue || signalCount > 0) {
    return 'Demander des compléments';
  }
  if (!analysis) {
    return 'Calculer le score';
  }
  const key = (analysis.recommendation || '').toUpperCase();
  if (key === 'UNFAVORABLE') {
    return 'Justifier l’avis défavorable';
  }
  return 'Transmettre au comité';
}

function decisionSummary(analysis: CreditAnalysis | null, checks: ReturnType<typeof buildDecisionChecks>, nextAction: string) {
  const score = formatScore(analysis?.overall_score);
  if (!analysis) {
    return `Le dossier doit encore être stabilisé avant décision. Action recommandée : ${nextAction}.`;
  }
  const risk =
    score == null
      ? 'non déterminé'
      : score >= 75
        ? 'faible'
        : score >= 60
          ? 'modéré'
          : 'élevé';
  const status = checks.hasBlockingIssue
    ? 'des blocages doivent être levés'
    : checks.hasWarning
      ? 'des points restent à confirmer'
      : 'les contrôles principaux sont satisfaits';
  return `Score ${score ?? '—'}/100, risque ${risk} : ${status}. Action recommandée : ${nextAction}.`;
}

function scoringFactors(analysis: CreditAnalysis | null) {
  return [
    ['Capacité de remboursement', analysis?.repayment_capacity_score],
    ['Cohérence revenus', analysis?.income_consistency_score],
    ['Charges', analysis?.expense_score],
    ['Pièces justificatives', analysis?.document_score],
    ['Garantie', analysis?.guarantee_score],
    ['Épargne', analysis?.savings_score],
    ['Historique crédit', analysis?.credit_history_score],
  ] as const;
}

function latestDate(values: Array<string | null | undefined>) {
  const dates = values
    .filter((value): value is string => Boolean(value))
    .map((value) => ({ value, time: Date.parse(value) }))
    .filter((item) => Number.isFinite(item.time))
    .sort((left, right) => right.time - left.time);
  return dates[0]?.value ?? values.find(Boolean) ?? null;
}

function statusKey(row: CreditRequest) {
  return (row.status || '').toUpperCase();
}

function isAnalysisStatus(row: CreditRequest) {
  return ['ANALYSIS', 'IN_ANALYSIS', 'PENDING_ANALYSIS'].includes(statusKey(row));
}

function isCommitteeOrLater(row: CreditRequest) {
  return ['COMMITTEE', 'PENDING_COMMITTEE', 'APPROVED', 'REJECTED', 'AMENDED'].includes(statusKey(row));
}

function isFinalDecision(row: CreditRequest) {
  return ['APPROVED', 'REJECTED', 'AMENDED'].includes(statusKey(row));
}

function timelineIcon(state: TimelineState) {
  if (state === 'done') {
    return 'fa-check';
  }
  if (state === 'active') {
    return 'fa-hourglass-half';
  }
  return 'fa-circle';
}

function renderWorkflowTimeline(steps: TimelineStep[]) {
  return steps
    .map((step) => `<div class="drawer-timeline-step is-${step.state}">
      <span class="drawer-timeline-dot"><i class="fas ${timelineIcon(step.state)}"></i></span>
      <span>
        <span class="drawer-timeline-title">
          <span>${escapeHtml(step.label)}</span>
          <span class="drawer-timeline-date">${escapeHtml(formatDate(step.date))}</span>
        </span>
        <span class="drawer-timeline-meta">${escapeHtml(step.detail)}</span>
      </span>
    </div>`)
    .join('');
}

function buildWorkflowTimeline(input: {
  row: CreditRequest;
  docs: CreditDocument[];
  guarantees: CreditGuarantee[];
  identityDocs: KycDocument[];
  checks: ReturnType<typeof buildDecisionChecks>;
  analysis: CreditAnalysis | null;
  target: 'agent' | 'analyst';
}) {
  const { row, docs, guarantees, identityDocs, checks, analysis, target } = input;
  const docsDate = latestDate([...docs.map((doc) => doc.uploaded_at), ...identityDocs.map((doc) => doc.uploaded_at)]);
  const guaranteeDate = latestDate(guarantees.map((item) => item.verified_at || item.created_at));
  const analysisDate = analysis?.created_at ?? null;
  const submittedDate = row.submitted_at || row.created_at;
  const docsReady = checks.docsOk && checks.kycVerified;
  const guaranteeStarted = guarantees.length > 0;
  const scoringReady = docsReady && checks.guaranteeVerified && checks.capacityOk;
  const analysisDone = isCommitteeOrLater(row);

  const finalLabel = target === 'agent' ? 'Analyse risque' : 'Comité de crédit';
  const finalDetail = target === 'agent'
    ? analysisDone
      ? 'Dossier transmis après contrôle agent.'
      : isAnalysisStatus(row)
        ? 'Instruction analyste en cours.'
        : 'En attente de transmission à l’analyste.'
    : isFinalDecision(row)
      ? `Décision enregistrée : ${creditStatusLabel(row.status)}.`
      : isCommitteeOrLater(row)
        ? 'Dossier prêt pour la décision d’octroi.'
        : 'Avis analyste à finaliser avant comité.';

  return [
    {
      label: 'Dépôt de la demande',
      detail: row.submitted_at ? 'Demande envoyée par le client.' : 'Brouillon créé par le client.',
      state: submittedDate ? 'done' : 'active',
      date: submittedDate,
    },
    {
      label: 'KYC et justificatifs',
      detail: docsReady
        ? 'Identité et pièces exploitables pour l’instruction.'
        : checks.hasBlockingIssue
          ? 'Pièces ou identité à corriger.'
          : 'Contrôles documentaires en cours.',
      state: docsReady ? 'done' : docs.length || identityDocs.length ? 'active' : 'todo',
      date: docsDate,
    },
    {
      label: 'Garantie terrain',
      detail: checks.guaranteeVerified
        ? 'Garantie vérifiée.'
        : guaranteeStarted
          ? 'Garantie déclarée, validation terrain attendue.'
          : 'Garantie à déclarer.',
      state: checks.guaranteeVerified ? 'done' : guaranteeStarted ? 'active' : 'todo',
      date: guaranteeDate,
    },
    {
      label: 'Scoring microcrédit',
      detail: analysis
        ? `Score calculé : ${formatScore(analysis.overall_score) ?? '—'}/100.`
        : scoringReady
          ? 'Dossier prêt pour le calcul du score.'
          : 'Score en attente des contrôles préalables.',
      state: analysis ? 'done' : scoringReady ? 'active' : 'todo',
      date: analysisDate,
    },
    {
      label: finalLabel,
      detail: finalDetail,
      state: isFinalDecision(row) || (target === 'agent' && analysisDone) ? 'done' : isAnalysisStatus(row) || isCommitteeOrLater(row) ? 'active' : 'todo',
      date: null,
    },
  ] satisfies TimelineStep[];
}

type ComplementIssue = {
  category: string;
  title: string;
  reason: string;
  impact: string;
  deadline: string;
  severity: 'bad' | 'warn' | 'ok';
  documentId?: number;
  kycDocumentId?: number;
};

type ReminderEvent = {
  title: string;
  message: string;
  date?: string | null;
  icon: string;
  state: 'sent' | 'received' | 'warning' | 'info';
  kind: 'reminder' | 'receipt' | 'status';
};

type AuditEvent = {
  title: string;
  detail: string;
  actor: string;
  date?: string | null;
  icon: string;
  state: 'done' | 'active' | 'warn';
};

function readableType(value?: string | null) {
  const text = (value || '').trim();
  return text ? text.replace(/[_-]+/g, ' ') : 'Pièce';
}

function documentName(doc?: CreditDocument | KycDocument | null) {
  return doc?.original_filename || readableType(doc?.document_type) || 'Pièce justificative';
}

function creditStatusBadgeClass(status?: string | null) {
  const key = (status || '').toUpperCase();
  if (['APPROVED', 'VALIDATED', 'DISBURSED'].includes(key)) {
    return 'badge badge-approved';
  }
  if (['REJECTED', 'CANCELLED'].includes(key)) {
    return 'badge badge-rejected';
  }
  if (['VERIFICATION_REQUIRED', 'TO_COMPLETE', 'INCOMPLETE'].includes(key)) {
    return 'badge badge-warning';
  }
  return 'badge badge-submitted';
}

function complementSeverityBadge(issue: ComplementIssue) {
  if (issue.severity === 'ok') {
    return { label: 'Suivi', cls: 'badge badge-approved', icon: 'fa-circle-check' };
  }
  if (issue.severity === 'warn') {
    return { label: 'À confirmer', cls: 'badge badge-warning', icon: 'fa-clock' };
  }
  return { label: 'Action requise', cls: 'badge badge-rejected', icon: 'fa-triangle-exclamation' };
}

function buildComplementIssue(input: {
  row: CreditRequest;
  docs: CreditDocument[];
  guarantees: CreditGuarantee[];
  identityDocs: KycDocument[];
  borrowerKyc?: string | null;
  disposable?: number;
}): ComplementIssue {
  const { row, docs, guarantees, identityDocs, borrowerKyc, disposable } = input;
  const hasIdentity = identityDocs.length > 0 || Boolean(borrowerKyc);
  const kycVerified = identityDocs.some((doc) => isVerifiedStatus(doc.status)) || isVerifiedStatus(borrowerKyc);
  const rejectedKyc = identityDocs.find((doc) => identityCheck(doc.status).tone === 'bad');
  const rejectedDoc = docs.find((doc) => documentCheck(doc.status).tone === 'bad');
  const toCompleteDoc = docs.find((doc) => documentCheck(doc.status).tone === 'warn');
  const rejectedGuarantee = guarantees.find((item) => isRejectedStatus(item.verification_status));
  const guaranteeWithoutFile = guarantees.find((item) => !guaranteeHasFile(item));
  const pendingGuarantee = guarantees.find((item) => !isVerifiedStatus(item.verification_status));
  const capacityKnown =
    (row.repayment_capacity_status || '').trim() || (disposable != null && row.estimated_monthly_payment != null);
  const capacityOk = capacityIsSufficient(row, disposable);

  if (!hasIdentity) {
    return {
      category: 'KYC',
      title: 'Pièce d’identité manquante',
      reason: 'Le dossier ne contient pas encore de pièce d’identité exploitable. Le KYC doit être complété avant toute décision de crédit.',
      impact: 'Blocage KYC et instruction analyste',
      deadline: '48 heures ouvrées',
      severity: 'bad',
    };
  }

  if (rejectedKyc) {
    return {
      category: 'KYC',
      title: documentName(rejectedKyc),
      reason: 'La pièce d’identité est rejetée ou illisible. Le client doit transmettre une pièce lisible et conforme.',
      impact: 'Blocage conformité identité',
      deadline: '48 heures ouvrées',
      severity: 'bad',
      kycDocumentId: rejectedKyc.id,
    };
  }

  if (!kycVerified) {
    const pending = identityDocs[0];
    return {
      category: 'KYC',
      title: pending ? documentName(pending) : 'KYC à confirmer',
      reason: 'L’identité est présente mais attend encore une validation agent. Cette étape sécurise le dossier avant scoring.',
      impact: 'Transmission analyste non sécurisée',
      deadline: 'Avant transmission analyste',
      severity: 'warn',
      kycDocumentId: pending?.id,
    };
  }

  if (rejectedDoc || toCompleteDoc) {
    const doc = rejectedDoc || toCompleteDoc;
    return {
      category: readableType(doc?.document_type).toUpperCase(),
      title: documentName(doc),
      reason: rejectedDoc
        ? 'Cette pièce est non conforme après contrôle. Le client doit transmettre une version lisible, récente et cohérente avec la demande.'
        : 'Cette pièce nécessite un complément ou une reprise avant que le score documentaire puisse être considéré comme fiable.',
      impact: 'Score documentaire pénalisé',
      deadline: '48 heures ouvrées',
      severity: rejectedDoc ? 'bad' : 'warn',
      documentId: doc?.id,
    };
  }

  if (!docs.length) {
    return {
      category: 'JUSTIFICATIF',
      title: 'Pièces justificatives manquantes',
      reason: 'Aucun justificatif de revenu, domicile ou activité n’est joint au dossier. Le scoring manque de preuve documentaire.',
      impact: 'Score documentaire incomplet',
      deadline: '48 heures ouvrées',
      severity: 'bad',
    };
  }

  if (!guarantees.length) {
    return {
      category: 'GARANTIE',
      title: 'Garantie non déclarée',
      reason: 'Le client doit déclarer une garantie ou une caution avant le contrôle terrain et la décision d’octroi.',
      impact: 'Score garantie non calculable',
      deadline: 'Avant analyse risque',
      severity: 'bad',
    };
  }

  if (rejectedGuarantee) {
    return {
      category: 'GARANTIE',
      title: readableType(rejectedGuarantee.guarantee_type),
      reason: 'La garantie déclarée a été rejetée. Une nouvelle garantie ou une correction terrain est nécessaire.',
      impact: 'Score garantie défavorable',
      deadline: 'Avant comité',
      severity: 'bad',
    };
  }

  if (guaranteeWithoutFile) {
    return {
      category: 'GARANTIE',
      title: readableType(guaranteeWithoutFile.guarantee_type),
      reason: 'La garantie est déclarée mais aucune preuve ou photo exploitable n’est jointe au dossier.',
      impact: 'Contrôle terrain incomplet',
      deadline: 'Avant transmission analyste',
      severity: 'warn',
    };
  }

  if (pendingGuarantee) {
    return {
      category: 'GARANTIE',
      title: readableType(pendingGuarantee.guarantee_type),
      reason: 'La garantie est déclarée et attend le contrôle terrain. L’agent doit finaliser la vérification avant l’avis analyste.',
      impact: 'Décision en attente terrain',
      deadline: 'Avant analyse risque',
      severity: 'warn',
    };
  }

  if (capacityKnown && !capacityOk) {
    return {
      category: 'CAPACITE',
      title: 'Capacité de remboursement insuffisante',
      reason: 'Le reste à vivre ou la mensualité estimée ne permet pas de soutenir le montant demandé. Une révision montant/durée ou un justificatif est nécessaire.',
      impact: 'Score remboursement défavorable',
      deadline: 'Avant avis analyste',
      severity: 'bad',
    };
  }

  return {
    category: 'SUIVI',
    title: 'Aucun complément bloquant',
    reason: 'Les contrôles principaux sont présents. Le dossier peut poursuivre son instruction si le score et l’avis humain sont cohérents.',
    impact: 'Aucun blocage actif',
    deadline: 'Suivi normal',
    severity: 'ok',
  };
}

function formatDateTimeShort(value?: string | null) {
  if (!value) {
    return 'Date non disponible';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return formatDate(value);
  }
  return date.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function searchText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function notificationRequestId(item: AppNotification) {
  const data = item.data;
  if (!data || typeof data !== 'object') {
    return undefined;
  }
  const record = data as Record<string, unknown>;
  const keys = ['request_id', 'credit_request_id', 'creditRequestId', 'credit_request'];
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    if (value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'number') {
      return (value as { id: number }).id;
    }
  }
  return undefined;
}

function filterComplementNotifications(items: AppNotification[], row: CreditRequest, borrower: string) {
  const id = row.id;
  const borrowerNeedle = searchText(borrower);
  return items
    .filter((item) => {
      const type = (item.type || '').toUpperCase();
      const text = searchText(`${item.title || ''} ${item.message || ''}`);
      const requestId = notificationRequestId(item);
      const matchesRequest =
        requestId === id ||
        text.includes(`#${id}`) ||
        text.includes(`dossier ${id}`) ||
        (borrowerNeedle.length > 2 && text.includes(borrowerNeedle));
      const looksLikeComplement =
        type === 'COMPLEMENTS_REQUESTED' ||
        text.includes('complement') ||
        text.includes('piece') ||
        text.includes('document') ||
        text.includes('relance');
      return matchesRequest && looksLikeComplement;
    })
    .sort((left, right) => Date.parse(right.created_at || '') - Date.parse(left.created_at || ''))
    .slice(0, 5);
}

function buildReminderEvents(input: {
  row: CreditRequest;
  issue: ComplementIssue;
  docs: CreditDocument[];
  identityDocs: KycDocument[];
  guarantees: CreditGuarantee[];
  notifications: AppNotification[];
}) {
  const events: ReminderEvent[] = input.notifications.map((item) => ({
    title: item.title || notificationTypeLabel(item.type),
    message: item.message || 'Notification envoyée au client.',
    date: item.created_at,
    icon: 'fa-paper-plane',
    state: 'sent',
    kind: 'reminder',
  }));

  const hasComplementReminder = events.some((event) => event.kind === 'reminder');
  if (['VERIFICATION_REQUIRED', 'TO_COMPLETE', 'INCOMPLETE'].includes(statusKey(input.row)) && !hasComplementReminder) {
    events.push({
      title: 'Demande de complément envoyée',
      message: input.issue.reason,
      date: input.row.submitted_at || input.row.created_at,
      icon: 'fa-paper-plane',
      state: 'sent',
      kind: 'reminder',
    });
  }

  input.docs.forEach((doc) => {
    if (!doc.uploaded_at) {
      return;
    }
    const check = documentCheck(doc.status);
    events.push({
      title: check.tone === 'bad' ? 'Pièce reçue non conforme' : 'Pièce reçue',
      message: `${documentName(doc)} • ${check.label}`,
      date: doc.uploaded_at,
      icon: check.tone === 'bad' ? 'fa-file-circle-exclamation' : 'fa-file-circle-check',
      state: check.tone === 'bad' ? 'warning' : 'received',
      kind: 'receipt',
    });
  });

  input.identityDocs.forEach((doc) => {
    if (!doc.uploaded_at) {
      return;
    }
    const check = identityCheck(doc.status);
    events.push({
      title: check.tone === 'bad' ? 'KYC reçu non conforme' : 'KYC reçu',
      message: `${documentName(doc)} • ${check.label}`,
      date: doc.uploaded_at,
      icon: check.tone === 'bad' ? 'fa-id-card-clip' : 'fa-id-card',
      state: check.tone === 'bad' ? 'warning' : 'received',
      kind: 'receipt',
    });
  });

  input.guarantees.forEach((item) => {
    if (!item.created_at) {
      return;
    }
    events.push({
      title: 'Garantie déclarée',
      message: `${readableType(item.guarantee_type)} • ${item.verification_status || 'PENDING'}`,
      date: item.created_at,
      icon: 'fa-shield-halved',
      state: isVerifiedStatus(item.verification_status) ? 'received' : 'info',
      kind: 'status',
    });
  });

  return events
    .sort((left, right) => Date.parse(right.date || '') - Date.parse(left.date || ''))
    .slice(0, 6);
}

function eventStatusLabel(event: ReminderEvent) {
  if (event.state === 'sent') {
    return 'Relance';
  }
  if (event.state === 'received') {
    return 'Reçu';
  }
  if (event.state === 'warning') {
    return 'À reprendre';
  }
  return 'Suivi';
}

function renderReminderJournal(events: ReminderEvent[]) {
  if (!events.length) {
    return '<div class="reminder-empty">Aucune relance tracée pour ce dossier.</div>';
  }
  return events
    .map(
      (event) => `<div class="reminder-event is-${event.state}">
        <span class="reminder-event-icon"><i class="fas ${event.icon}"></i></span>
        <span class="reminder-event-body">
          <span class="reminder-event-title">
            <span>${escapeHtml(event.title)}</span>
            <span class="reminder-event-date">${escapeHtml(formatDateTimeShort(event.date))}</span>
          </span>
          <span class="reminder-event-message">${escapeHtml(event.message)}</span>
          <span class="reminder-event-status">${escapeHtml(eventStatusLabel(event))}</span>
        </span>
      </div>`,
    )
    .join('');
}

function auditIcon(state: AuditEvent['state']) {
  if (state === 'done') {
    return 'fa-check';
  }
  if (state === 'warn') {
    return 'fa-triangle-exclamation';
  }
  return 'fa-hourglass-half';
}

function renderDossierAuditTrail(events: AuditEvent[]) {
  if (!events.length) {
    return '<div class="reminder-empty">Aucun événement audit disponible pour ce dossier.</div>';
  }
  return events
    .map(
      (event) => `<div class="audit-event is-${event.state}">
        <span class="audit-event-icon"><i class="fas ${event.icon || auditIcon(event.state)}"></i></span>
        <span>
          <span class="audit-event-title">
            <span>${escapeHtml(event.title)}</span>
            <span class="audit-event-date">${escapeHtml(formatDateTimeShort(event.date))}</span>
          </span>
          <span class="audit-event-detail">${escapeHtml(event.detail)}</span>
          <span class="audit-event-actor">${escapeHtml(event.actor)}</span>
        </span>
      </div>`,
    )
    .join('');
}

function buildDossierAuditTrail(input: {
  row: CreditRequest;
  docs: CreditDocument[];
  guarantees: CreditGuarantee[];
  identityDocs: KycDocument[];
  analysis: CreditAnalysis | null;
  target: 'agent' | 'analyst';
}) {
  const { row, docs, guarantees, identityDocs, analysis, target } = input;
  const status = statusKey(row);
  const docsDate = latestDate([...docs.map((doc) => doc.uploaded_at), ...identityDocs.map((doc) => doc.uploaded_at)]);
  const docsRejected = docs.filter((doc) => documentCheck(doc.status).tone === 'bad').length;
  const kycRejected = identityDocs.filter((doc) => identityCheck(doc.status).tone === 'bad').length;
  const kycVerified = identityDocs.some((doc) => identityCheck(doc.status).tone === 'good');
  const guaranteeDate = latestDate(guarantees.map((item) => item.verified_at || item.created_at));
  const guaranteeVerified = guarantees.some((item) => isVerifiedStatus(item.verification_status));
  const guaranteeRejected = guarantees.some((item) => isRejectedStatus(item.verification_status));
  const score = formatScore(analysis?.overall_score);
  const events: AuditEvent[] = [];

  events.push({
    title: row.submitted_at ? 'Dossier déposé' : 'Dossier créé',
    detail: row.submitted_at
      ? `Demande #${row.id} envoyée pour instruction.`
      : `Brouillon #${row.id} créé, en attente d’envoi client.`,
    actor: 'Client',
    date: row.submitted_at || row.created_at,
    icon: 'fa-file-circle-plus',
    state: row.submitted_at ? 'done' : 'active',
  });

  events.push({
    title: 'Pièces et KYC',
    detail: docs.length || identityDocs.length
      ? `${docs.length} pièce${docs.length > 1 ? 's' : ''} dossier, ${identityDocs.length} pièce${identityDocs.length > 1 ? 's' : ''} KYC. ${docsRejected + kycRejected ? `${docsRejected + kycRejected} non conforme${docsRejected + kycRejected > 1 ? 's' : ''}.` : kycVerified ? 'Identité conforme ou contrôlée.' : 'Contrôle en cours.'}`
      : 'Aucune pièce justificative exploitable n’est encore jointe au dossier.',
    actor: docs.length || identityDocs.length ? 'Client / Agent' : 'Client',
    date: docsDate,
    icon: docsRejected || kycRejected ? 'fa-file-circle-exclamation' : 'fa-id-card',
    state: docsRejected || kycRejected || (!docs.length && !identityDocs.length) ? 'warn' : 'done',
  });

  if (['VERIFICATION_REQUIRED', 'TO_COMPLETE', 'INCOMPLETE'].includes(status)) {
    events.push({
      title: 'Complément demandé',
      detail: 'Le dossier a été renvoyé au client pour pièce manquante, pièce non conforme ou garantie à compléter.',
      actor: target === 'agent' ? 'Agent de crédit' : 'Analyste risque',
      date: latestDate([docsDate, row.submitted_at, row.created_at]),
      icon: 'fa-paper-plane',
      state: 'warn',
    });
  }

  events.push({
    title: 'Garantie et terrain',
    detail: guarantees.length
      ? guaranteeVerified
        ? 'Garantie déclarée et vérifiée pour soutenir la décision.'
        : guaranteeRejected
          ? 'Garantie rejetée ou non exploitable.'
          : 'Garantie déclarée, contrôle terrain encore attendu ou incomplet.'
      : 'Aucune garantie déclarée dans le dossier.',
    actor: guarantees.length ? 'Agent terrain' : 'Client',
    date: guaranteeDate,
    icon: guaranteeVerified ? 'fa-shield-check' : 'fa-shield-halved',
    state: guaranteeVerified ? 'done' : 'warn',
  });

  events.push({
    title: 'Scoring microcrédit',
    detail: analysis
      ? `Score ${score ?? '—'}/100, confiance ${formatScore(analysis.confidence_score) ?? '—'}%, recommandation ${scoringLabel(analysis.recommendation).toLowerCase()}.`
      : 'Score non calculé ou non disponible. La décision humaine doit attendre un dossier stabilisé.',
    actor: 'Moteur scoring',
    date: analysis?.created_at,
    icon: 'fa-chart-line',
    state: analysis ? 'done' : 'active',
  });

  if (isAnalysisStatus(row) || isCommitteeOrLater(row) || isFinalDecision(row)) {
    events.push({
      title: 'Avis analyste',
      detail: analysis
        ? `Avis préparé pour le comité : ${scoringLabel(analysis.recommendation).toLowerCase()}.`
        : 'Dossier en file analyste, avis attendu.',
      actor: 'Analyste risque',
      date: analysis?.created_at,
      icon: 'fa-user-check',
      state: analysis ? 'done' : 'active',
    });
  }

  if (isCommitteeOrLater(row) || isFinalDecision(row)) {
    events.push({
      title: isFinalDecision(row) ? 'Décision comité enregistrée' : 'File comité',
      detail: isFinalDecision(row)
        ? `Décision : ${creditStatusLabel(row.status)}. Montant accordé : ${formatFcfa(row.approved_amount ?? row.requested_amount)}.`
        : 'Le dossier est prêt pour arbitrage du comité de crédit.',
      actor: 'Comité de crédit',
      date: null,
      icon: 'fa-gavel',
      state: isFinalDecision(row) ? 'done' : 'active',
    });
  }

  if (row.loan_id || row.loan?.id) {
    events.push({
      title: 'Prêt créé',
      detail: `Contrat prêt #${row.loan_id ?? row.loan?.id} généré après décision favorable.`,
      actor: 'Back-office',
      date: null,
      icon: 'fa-file-contract',
      state: 'done',
    });
  }

  return events.slice(-8);
}

function buildDefaultReminderMessage(row: CreditRequest, issue: ComplementIssue) {
  return `CreditFast - Dossier #${row.id} : ${issue.title}. ${issue.reason} Merci de régulariser sous ${issue.deadline}.`;
}

async function loadComplementContext(id: number) {
  const row = await loadRequest(id);
  if (!row) {
    return null;
  }
  const clientId = row.client_id ?? row.client?.id;
  const [docs, guarantees, fiche, kycDocs] = await Promise.all([
    listCreditRequestDocuments(row.id).catch(() => []),
    listCreditRequestGuarantees(row.id).catch(() => [] as CreditGuarantee[]),
    loadFiche(row),
    clientId ? listAgentClientKycDocuments(clientId).catch(() => [] as KycDocument[]) : Promise.resolve([] as KycDocument[]),
  ]);
  const nestedKyc = Array.isArray(fiche?.kyc_documents) ? fiche.kyc_documents : [];
  const identityDocs = kycDocs.length ? kycDocs : nestedKyc;
  const borrower = mergeBorrower(row, fiche);
  const income = row.declared_monthly_income;
  const expenses = row.declared_monthly_expenses;
  const disposable = income != null && expenses != null ? income - expenses : undefined;
  const issue = buildComplementIssue({
    row,
    docs,
    guarantees,
    identityDocs,
    borrowerKyc: borrower.kyc,
    disposable,
  });

  return { row, clientId, docs, guarantees, fiche, identityDocs, borrower, issue };
}

function locationFrom(fiche: AgentClient | null, request: CreditRequest) {
  return (
    fiche?.city ||
    fiche?.residential_zone ||
    fiche?.address ||
    request.client?.city ||
    request.client?.residential_zone ||
    request.client?.address ||
    ''
  );
}

async function loadRequest(id: number) {
  try {
    return await getCreditRequest(id);
  } catch {
    const rows = await listAgentRequests().catch(() => [] as CreditRequest[]);
    return rows.find((row) => row.id === id) ?? null;
  }
}

async function loadFiche(request: CreditRequest) {
  const clientId = request.client_id ?? request.client?.id;
  if (!clientId) {
    return null;
  }
  try {
    return await getAgentClient(clientId);
  } catch {
    return null;
  }
}

function mergeBorrower(request: CreditRequest, fiche: AgentClient | null) {
  const user = fiche?.user || request.client?.user;
  const name =
    (fiche ? agentClientName(fiche) : '') ||
    borrowerName({ client: { ...request.client, user } });
  return {
    name,
    phone: user?.phone || request.client?.phone || null,
    email: user?.email || request.client?.email || null,
    occupation: fiche?.occupation || request.client?.occupation || '',
    location: locationFrom(fiche, request),
    number: fiche?.client_number || request.client?.client_number || (request.client_id ? `#${request.client_id}` : ''),
    kyc: fiche?.kyc_status || request.client?.kyc_status || '',
  };
}

function applyScore(analysis: CreditAnalysis | null) {
  const score = formatScore(analysis?.overall_score);
  const confidence = formatScore(analysis?.confidence_score);
  setText('agent-drawer-score-val', score != null ? String(score) : '—');
  setText('agent-drawer-score-label', scoringLabel(analysis?.recommendation));
  setText('agent-drawer-confidence-val', confidence != null ? `${confidence}%` : '—');
  const progress = document.getElementById('agent-drawer-score-progress');
  if (progress) {
    progress.style.width = `${score ?? 0}%`;
  }
  const badge = document.getElementById('agent-drawer-score-label');
  if (badge) {
    const key = (analysis?.recommendation || '').toUpperCase();
    badge.className = `badge ${key === 'FAVORABLE' ? 'badge-approved' : key === 'UNFAVORABLE' ? 'badge-rejected' : 'badge-submitted'}`;
    badge.style.fontSize = '0.7rem';
  }
}

export async function fillAndOpenAgentDrawer(identifier?: string) {
  const parsed = Number(identifier);
  const selected = Number.isFinite(parsed) && parsed > 0 ? parsed : getSelectedCreditRequestId();
  if (!selected) {
    toast.info('Aucun dossier sélectionné.');
    return;
  }
  const row = await loadRequest(selected);
  if (!row) {
    toast.info('Dossier introuvable en base.');
    return;
  }
  setSelectedCreditRequestId(row.id);

  const clientId = row.client_id ?? row.client?.id;
  const [docs, guarantees, fiche, analysis, kycDocs] = await Promise.all([
    listCreditRequestDocuments(row.id).catch(() => []),
    listCreditRequestGuarantees(row.id).catch(() => [] as CreditGuarantee[]),
    loadFiche(row),
    loadCreditAnalysis(row.id).catch(() => null),
    clientId ? listAgentClientKycDocuments(clientId).catch(() => [] as KycDocument[]) : Promise.resolve([] as KycDocument[]),
  ]);

  const nestedKyc = Array.isArray(fiche?.kyc_documents) ? fiche.kyc_documents : [];
  const identityDocs = kycDocs.length ? kycDocs : nestedKyc;
  const guarantee = guarantees[0];
  const income = row.declared_monthly_income;
  const expenses = row.declared_monthly_expenses;
  const disposable = income != null && expenses != null ? income - expenses : undefined;
  const borrower = mergeBorrower(row, fiche);
  const capacity = (row.repayment_capacity_status || '').toUpperCase();

  setText('agent-drawer-title', `Dossier #${row.id}`);
  setText('agent-drawer-date', `Déposé le ${formatDate(row.submitted_at || row.created_at)}`);
  setText('agent-drawer-hero-amount', formatFcfa(row.requested_amount));
  const statusEl = document.getElementById('agent-drawer-hero-status');
  if (statusEl) {
    statusEl.textContent = creditStatusLabel(row.status);
  }
  setText('agent-drawer-client-number', dash(borrower.number));
  setText('agent-drawer-client-name', borrower.name);
  setText('agent-drawer-client-occupation', dash(borrower.occupation));
  setText('agent-drawer-client-location', dash(borrower.location));
  setText('agent-drawer-client-phone', dash(borrower.phone));
  setText('agent-drawer-client-email', dash(borrower.email));
  const kyc = document.getElementById('agent-drawer-client-kyc');
  if (kyc) {
    const ident = identityCheck(borrower.kyc);
    kyc.textContent = borrower.kyc ? ident.label : '—';
    kyc.className = ident.badgeClass;
    kyc.style.fontSize = '0.68rem';
    (kyc as HTMLElement).style.alignSelf = 'flex-start';
  }
  const avatar = document.getElementById('agent-drawer-client-avatar') as HTMLImageElement | null;
  if (avatar) {
    avatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(borrower.name)}&background=1b4332&color=fff`;
  }
  bindHrefButton('agent-drawer-btn-sms', phoneHref(borrower.phone, 'sms'), 'Aucun téléphone en base.');
  bindHrefButton('agent-drawer-btn-call', phoneHref(borrower.phone, 'tel'), 'Aucun téléphone en base.');

  setHtml(
    'agent-drawer-capacity-badge',
    capacity === 'SUFFICIENT'
      ? '<span class="badge badge-approved">Capacité suffisante</span>'
      : capacity === 'INSUFFICIENT'
        ? '<span class="badge badge-rejected">Capacité insuffisante</span>'
        : '<span class="badge badge-submitted">—</span>',
  );
  setText('agent-drawer-duration', row.duration_months ? `${row.duration_months} mois` : '—');
  setText('agent-drawer-monthly-payment', formatFcfa(row.estimated_monthly_payment));
  setText('agent-drawer-income', formatFcfa(income));
  setText('agent-drawer-expenses', formatFcfa(expenses));
  setText('agent-drawer-disposable', formatFcfa(disposable));
  setText('agent-drawer-purpose', row.purpose || '—');
  setText('agent-drawer-guarantee-type', guarantee?.guarantee_type || '—');
  setText('agent-drawer-guarantee-desc', guarantee?.description || '—');
  setText('agent-drawer-guarantee-declared', formatFcfa(guarantee?.declared_value));
  setText('agent-drawer-guarantee-verified', formatFcfa(guarantee?.verified_value));
  setText('agent-drawer-guarantee-status', guarantee?.verification_status || 'Aucune');
  const guaranteeFileBtn = document.getElementById('agent-drawer-btn-guarantee-file');
  if (guaranteeFileBtn) {
    const canView = guaranteeHasFile(guarantee);
    guaranteeFileBtn.style.display = canView ? '' : 'none';
    guaranteeFileBtn.onclick = () => {
      if (!guarantee) {
        return;
      }
      void import('@/features/workflow/fillDocLightbox').then(({ openDocLightbox }) =>
        openDocLightbox(`GUARANTEE-${row.id}-${guarantee.id}`),
      );
    };
  }
  const totalPieces = docs.length + identityDocs.length;
  const complianceIssues = docs.filter(isDocumentRejected).length + identityDocs.filter(isDocumentRejected).length;
  const docsCount = document.getElementById('agent-drawer-docs-count');
  if (docsCount) {
    docsCount.textContent = `${totalPieces} pièce${totalPieces > 1 ? 's' : ''}`;
    docsCount.className = complianceIssues ? 'badge badge-rejected' : 'badge badge-submitted';
  }
  const list = document.getElementById('agent-drawer-docs-list');
  if (list) {
    const creditLines = docs.map((doc) => {
      const check = documentCheck(doc.status);
      const excerpt = doc.analysis_summary || (typeof doc.extracted_text === 'string' ? doc.extracted_text.slice(0, 90) : '');
      return `<div data-open-doc="CREDIT-${row.id}-${doc.id}" style="padding:0.45rem 0.55rem;border:1px solid var(--border-color);border-radius:var(--radius-sm);background:var(--bg-surface-secondary);cursor:pointer">
        <div style="display:flex;justify-content:space-between;gap:0.5rem;align-items:center">
          <span style="font-size:0.8rem;font-weight:600">${doc.original_filename || doc.document_type || 'Pièce de crédit'}</span>
          <span class="${check.badgeClass}" style="font-size:0.65rem;flex-shrink:0">${check.label}</span>
        </div>
        ${excerpt ? `<p style="margin:0.35rem 0 0;font-size:0.72rem;color:var(--text-muted)">${excerpt}${excerpt.length >= 90 ? '…' : ''}</p>` : '<p style="margin:0.35rem 0 0;font-size:0.72rem;color:var(--text-muted)">Le système lit cette pièce après dépôt. Cliquez pour ouvrir.</p>'}
      </div>`;
    });
    const kycLines = identityDocs.map((doc) => {
      const check = identityCheck(doc.status);
      const pending = check.tone !== 'good' && check.tone !== 'bad';
      return `<div data-open-doc="${clientId ? `KYC-${clientId}-${doc.id}` : `KYC-${doc.id}`}" style="padding:0.45rem 0.55rem;border:1px solid var(--border-color);border-radius:var(--radius-sm);cursor:pointer">
        <div style="display:flex;justify-content:space-between;gap:0.5rem;align-items:center">
          <span style="font-size:0.8rem;font-weight:600">Identité · ${doc.original_filename || doc.document_type || 'Pièce'}</span>
          <span class="${check.badgeClass}" style="font-size:0.65rem;flex-shrink:0">${check.label}</span>
        </div>
        ${pending && clientId ? `<div style="display:flex;gap:0.35rem;margin-top:0.4rem">
          <button type="button" class="btn btn-primary btn-sm" data-kyc-decision="VERIFIED" data-kyc-id="${doc.id}" style="font-size:0.68rem">Identité conforme</button>
          <button type="button" class="btn btn-secondary btn-sm" data-kyc-decision="REJECTED" data-kyc-id="${doc.id}" style="font-size:0.68rem">Non conforme</button>
        </div>` : ''}
      </div>`;
    });
    list.innerHTML =
      creditLines.concat(kycLines).join('') ||
      '<p style="margin:0;font-size:0.8rem;color:var(--text-muted)">Aucune pièce en base. Demandez des compléments.</p>';
    list.onclick = (event) => {
      const kycBtn = (event.target as HTMLElement).closest<HTMLElement>('[data-kyc-decision]');
      if (kycBtn && clientId) {
        event.stopPropagation();
        const documentId = Number(kycBtn.dataset.kycId);
        const decision = kycBtn.dataset.kycDecision as 'VERIFIED' | 'REJECTED';
        void verifyIdentityFromDrawer(clientId, documentId, decision);
        return;
      }
      const open = (event.target as HTMLElement).closest<HTMLElement>('[data-open-doc]');
      if (open?.dataset.openDoc) {
        void import('@/features/workflow/fillDocLightbox').then(({ openDocLightbox }) => openDocLightbox(open.dataset.openDoc));
      }
    };
  }
  applyScore(analysis);
  const ready =
    docs.length > 0 &&
    !docs.some(isDocumentRejected) &&
    !identityDocs.some(isDocumentRejected) &&
    guarantees.some((item) => (item.verification_status || '').toUpperCase() === 'VERIFIED');
  const decisionChecks = buildDecisionChecks({
    row,
    docs,
    guarantees,
    identityDocs,
    borrowerKyc: borrower.kyc,
    disposable,
  });
  const nextAction = nextActionForAgent(decisionChecks, analysis);
  setText('agent-drawer-next-action', nextAction);
  setText('agent-drawer-decision-summary', decisionSummary(analysis, decisionChecks, nextAction));
  setHtml('agent-drawer-decision-checklist', renderDecisionChecklist(decisionChecks.items));
  setHtml('agent-drawer-score-factors', renderDecisionFactors(scoringFactors(analysis)));
  setHtml(
    'agent-drawer-workflow-timeline',
    renderWorkflowTimeline(
      buildWorkflowTimeline({
        row,
        docs,
        guarantees,
        identityDocs,
        checks: decisionChecks,
        analysis,
        target: 'agent',
      }),
    ),
  );
  setText('agent-drawer-timeline-badge', creditStatusLabel(row.status));
  const agentAuditEvents = buildDossierAuditTrail({ row, docs, guarantees, identityDocs, analysis, target: 'agent' });
  setHtml('agent-drawer-audit-trail', renderDossierAuditTrail(agentAuditEvents));
  setText('agent-drawer-audit-badge', `${agentAuditEvents.length} trace${agentAuditEvents.length > 1 ? 's' : ''}`);
  const transfer = document.getElementById('agent-drawer-btn-transfer') as HTMLButtonElement | null;
  if (transfer) {
    transfer.style.display = ready ? '' : 'none';
    transfer.disabled = !ready;
    transfer.title = ready
      ? 'Transmettre à l’analyste'
      : 'Pièces conformes, garantie et contrôle terrain sont requis.';
  }
  const analyse = document.getElementById('agent-drawer-btn-360') as HTMLButtonElement | null;
  if (analyse) {
    analyse.style.gridColumn = ready ? 'auto' : '1 / -1';
  }
  const complements = document.getElementById('agent-drawer-btn-complements');
  if (complements) {
    complements.className = `btn btn-sm agent-drawer-footer-btn ${ready ? 'btn-secondary' : 'btn-primary'}`;
  }
  showBackdrop('agent-drawer-backdrop');
}

export async function verifyIdentityFromDrawer(
  clientId: number,
  documentId: number,
  decision: 'VERIFIED' | 'REJECTED',
) {
  try {
    await verifyKycDocument(clientId, documentId, {
      decision,
      rejection_reason: decision === 'REJECTED' ? 'Pièce d’identité illisible ou non conforme.' : undefined,
    });
    notifyRequestsChanged();
    toast.success(decision === 'VERIFIED' ? 'Identité marquée conforme.' : 'Identité marquée non conforme.');
    await fillAndOpenAgentDrawer(String(getSelectedCreditRequestId() || ''));
  } catch (error) {
    toast.danger(isApiError(error) ? error.message : 'Impossible d’enregistrer le contrôle d’identité.');
  }
}

export async function requestComplementsFromAgentDrawer() {
  const id = getSelectedCreditRequestId();
  if (!id) {
    toast.info('Aucun dossier sélectionné.');
    return;
  }
  const comment = window.prompt(
    'Message au client (min. 5 caractères) :',
    'Merci de joindre les pièces justificatives et de déclarer une garantie pour que le dossier puisse être transmis à l’analyste.',
  );
  if (comment == null) {
    return;
  }
  if (comment.trim().length < 5) {
    toast.warning('Le commentaire doit contenir au moins 5 caractères.');
    return;
  }
  try {
    await requestComplements(id, comment.trim());
    notifyRequestsChanged();
    toast.success('Compléments demandés. Le demandeur est notifié dans son espace.');
    await fillAndOpenAgentDrawer(String(id));
  } catch (error) {
    toast.danger(isApiError(error) ? error.message : 'Impossible de demander des compléments.');
  }
}

export async function fillAndOpenInspectionDrawer(identifier?: string) {
  const guaranteeId = Number(identifier);
  if (!Number.isFinite(guaranteeId) || guaranteeId <= 0) {
    toast.info('Aucune garantie sélectionnée.');
    return;
  }
  const requests = await listAgentRequests().catch(() => [] as CreditRequest[]);
  let match: { request: CreditRequest; guarantee: CreditGuarantee } | null = null;
  for (const request of requests) {
    const items = await listCreditRequestGuarantees(request.id).catch(() => [] as CreditGuarantee[]);
    const guarantee = items.find((item) => item.id === guaranteeId);
    if (guarantee) {
      match = { request, guarantee };
      break;
    }
  }
  if (!match) {
    toast.info('Garantie introuvable en base.');
    return;
  }
  setSelectedCreditRequestId(match.request.id);
  let guarantee = match.guarantee;
  try {
    const detailed = await getCreditGuarantee(match.request.id, match.guarantee.id);
    if (detailed) {
      guarantee = detailed;
      match = { request: match.request, guarantee };
    }
  } catch {
    // la fiche liste suffit si le détail unitaire est indisponible
  }
  const fiche = await loadFiche(match.request);
  const name = mergeBorrower(match.request, fiche).name;
  setText('insp-drawer-title', `Inspection • Dossier #${match.request.id}`);
  setText('insp-drawer-req-num', `#${match.request.id}`);
  setText('insp-drawer-client-name', name);
  setText('insp-drawer-client-loc', dash(locationFrom(fiche, match.request)));
  setText('insp-drawer-loan-amount', formatFcfa(match.request.requested_amount));
  setText('insp-drawer-val-declared', formatFcfa(guarantee.declared_value));
  setText('insp-drawer-val-verified', formatFcfa(guarantee.verified_value));
  setText('insp-drawer-desc', guarantee.description || '—');
  const status = document.getElementById('insp-drawer-status-badge');
  if (status) {
    status.textContent = guarantee.verification_status || 'PENDING';
  }
  setText('insp-client-name', `${name} • #${match.request.id}`);
  setText('insp-guarantee-type', guarantee.guarantee_type || '—');
  const hidden = document.getElementById('insp-guarantee-id') as HTMLInputElement | null;
  if (hidden) {
    hidden.value = String(guarantee.id);
  }
  const declared = document.getElementById('insp-declared-val') as HTMLInputElement | null;
  if (declared) {
    declared.value = guarantee.declared_value != null ? String(guarantee.declared_value) : '';
  }
  const fileRow = document.getElementById('insp-drawer-file-row');
  const fileBtn = document.getElementById('insp-drawer-btn-file');
  if (fileRow && fileBtn) {
    const canView = guaranteeHasFile(guarantee);
    fileRow.style.display = canView ? '' : 'none';
    fileBtn.onclick = () => {
      void import('@/features/workflow/fillDocLightbox').then(({ openDocLightbox }) =>
        openDocLightbox(`GUARANTEE-${match!.request.id}-${guarantee.id}`),
      );
    };
  }
  showBackdrop('inspection-drawer-backdrop');
}

export async function openInspectionFromAgentDrawer() {
  const id = getSelectedCreditRequestId();
  if (!id) {
    toast.info('Ouvrez d’abord un dossier.');
    return;
  }
  const items = await listCreditRequestGuarantees(id).catch(() => [] as CreditGuarantee[]);
  const pending = items.find((item) => (item.verification_status || 'PENDING').toUpperCase() !== 'VERIFIED') ?? items[0];
  if (!pending) {
    toast.warning('Aucune garantie à contrôler. Demandez un complément au demandeur.');
    return;
  }
  showBackdrop('agent-drawer-backdrop', false);
  await fillAndOpenInspectionDrawer(String(pending.id));
}

export async function saveInspectionReport() {
  const hidden = document.getElementById('insp-guarantee-id') as HTMLInputElement | null;
  const id = Number(hidden?.value);
  if (!Number.isFinite(id) || id <= 0) {
    toast.info('Aucune garantie sélectionnée.');
    return;
  }
  const verifiedRaw = (document.getElementById('insp-verified-val') as HTMLInputElement | null)?.value;
  const verifiedValue = verifiedRaw ? Number(verifiedRaw) : undefined;
  try {
    await verifyGuarantee(id, {
      verification_status: 'VERIFIED',
      verified_value: verifiedValue != null && !Number.isNaN(verifiedValue) ? verifiedValue : undefined,
    });
    notifyRequestsChanged();
    showBackdrop('modal-inspection', false);
    showBackdrop('inspection-drawer-backdrop', false);
    toast.success('Contrôle terrain enregistré. Vous pouvez transmettre à l’analyste si les pièces sont jointes.');
  } catch (error) {
    toast.danger(isApiError(error) ? error.message : 'Impossible d’enregistrer le contrôle.');
  }
}

export async function fillAndOpenComplementsDrawer(identifier?: string) {
  const parsed = Number(identifier);
  const selected = Number.isFinite(parsed) && parsed > 0 ? parsed : getSelectedCreditRequestId();
  if (!selected) {
    toast.info('Aucun dossier sélectionné.');
    return;
  }
  const context = await loadComplementContext(selected);
  if (!context) {
    toast.info('Dossier introuvable en base.');
    return;
  }
  const { row, docs, guarantees, identityDocs, borrower, issue } = context;
  setSelectedCreditRequestId(row.id);
  const notifications = await listNotifications()
    .then((payload) => filterComplementNotifications(payload.items, row, borrower.name))
    .catch(() => [] as AppNotification[]);
  const events = buildReminderEvents({ row, issue, docs, identityDocs, guarantees, notifications });
  const remindersCount = events.filter((event) => event.kind === 'reminder').length;
  const severity = complementSeverityBadge(issue);

  setText('comp-drawer-title', `Compléments • Dossier #${row.id}`);
  setText('comp-drawer-subtitle', `${issue.title} • ${creditStatusLabel(row.status)}`);
  setText('comp-drawer-req-num', `#${row.id}`);
  setText('comp-drawer-client-name', borrower.name);
  setText('comp-drawer-client-loc', dash(borrower.location));
  setText('comp-drawer-client-phone', dash(borrower.phone));
  setText('comp-drawer-loan-amount', formatFcfa(row.requested_amount));
  setText('comp-drawer-doc-type', issue.category);
  setText('comp-drawer-doc-name', issue.title);
  setText('comp-drawer-reason', issue.reason);
  setText('comp-drawer-impact', issue.impact);
  setText('comp-drawer-deadline', issue.deadline);
  setText('comp-drawer-reminders-count', `${remindersCount} relance${remindersCount > 1 ? 's' : ''}`);
  setHtml('comp-drawer-timeline', renderReminderJournal(events));

  const statusBadge = document.getElementById('comp-drawer-status-badge');
  if (statusBadge) {
    statusBadge.textContent = creditStatusLabel(row.status);
    statusBadge.className = creditStatusBadgeClass(row.status);
  }
  const severityBadge = document.getElementById('comp-drawer-severity-badge');
  if (severityBadge) {
    severityBadge.className = severity.cls;
    severityBadge.innerHTML = `<i class="fas ${severity.icon}"></i> ${severity.label}`;
  }
  const docType = document.getElementById('comp-drawer-doc-type');
  if (docType) {
    docType.className = issue.severity === 'ok' ? 'badge badge-approved' : issue.severity === 'warn' ? 'badge badge-warning' : 'badge badge-rejected';
    (docType as HTMLElement).style.fontSize = '0.65rem';
  }
  const avatar = document.getElementById('comp-drawer-client-avatar') as HTMLImageElement | null;
  if (avatar) {
    avatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(borrower.name)}&background=4f46e5&color=fff`;
  }
  const validate = document.getElementById('comp-drawer-btn-validate') as HTMLButtonElement | null;
  if (validate) {
    const hasReceivable = Boolean(issue.documentId || issue.kycDocumentId || docs.length);
    validate.disabled = !hasReceivable;
    validate.style.opacity = hasReceivable ? '' : '0.65';
    validate.title = hasReceivable ? 'Marquer la pièce reçue comme conforme' : 'Aucune pièce reçue à valider';
  }
  showBackdrop('complements-drawer-backdrop');
}

export async function triggerReminderFromDrawer() {
  const id = getSelectedCreditRequestId();
  if (!id) {
    toast.info('Aucun dossier sélectionné.');
    return;
  }
  const context = await loadComplementContext(id);
  if (!context) {
    toast.info('Dossier introuvable en base.');
    return;
  }
  const message = window.prompt('Message de relance au client :', buildDefaultReminderMessage(context.row, context.issue));
  if (message == null) {
    return;
  }
  if (message.trim().length < 5) {
    toast.warning('Le message doit contenir au moins 5 caractères.');
    return;
  }
  try {
    await requestComplements(context.row.id, message.trim());
    notifyRequestsChanged();
    toast.success('Relance envoyée. Le journal du dossier est rafraîchi.');
    await fillAndOpenComplementsDrawer(String(context.row.id));
  } catch (error) {
    toast.danger(isApiError(error) ? error.message : 'Impossible d’envoyer la relance.');
  }
}

export async function markDocReceivedFromDrawer() {
  const id = getSelectedCreditRequestId();
  if (!id) {
    toast.info('Aucun dossier sélectionné.');
    return;
  }
  const context = await loadComplementContext(id);
  if (!context) {
    toast.info('Dossier introuvable en base.');
    return;
  }

  try {
    if (context.issue.kycDocumentId && context.clientId) {
      await verifyKycDocument(context.clientId, context.issue.kycDocumentId, { decision: 'VERIFIED' });
      toast.success('Pièce KYC marquée conforme.');
    } else {
      const candidate =
        (context.issue.documentId ? context.docs.find((doc) => doc.id === context.issue.documentId) : undefined) ||
        context.docs.find((doc) => !isVerifiedStatus(doc.status)) ||
        context.docs[0];

      if (!candidate) {
        toast.warning('Aucune pièce reçue à valider. Relancez le client ou attendez le dépôt.');
        return;
      }

      await submitHumanValidation(context.row.id, {
        validation_type: 'DOCUMENT',
        decision: 'VALIDATED',
        document_id: candidate.id,
        comment: 'Pièce reçue via le suivi des compléments et marquée conforme.',
      });
      toast.success('Pièce marquée reçue et conforme.');
    }
    notifyRequestsChanged();
    await fillAndOpenComplementsDrawer(String(context.row.id));
  } catch (error) {
    toast.danger(isApiError(error) ? error.message : 'Impossible de valider la pièce.');
  }
}

export function triggerDrawerFileUpload() {
  toast.info('Dépôt direct agent prévu côté mobile/GED. Pour l’instant, utilisez la relance client et le suivi des pièces.');
}

export async function fillAndOpenAnalystDrawer(identifier?: string) {
  const parsed = Number(identifier);
  const selected = Number.isFinite(parsed) && parsed > 0 ? parsed : getSelectedCreditRequestId();
  if (!selected) {
    toast.info('Aucun dossier sélectionné.');
    return;
  }
  const row = await loadRequest(selected);
  if (!row) {
    toast.info('Dossier introuvable en base.');
    return;
  }
  setSelectedCreditRequestId(row.id);
  const clientId = row.client_id ?? row.client?.id;
  const [docs, guarantees, fiche, analysis, kycDocs] = await Promise.all([
    listCreditRequestDocuments(row.id).catch(() => []),
    listCreditRequestGuarantees(row.id).catch(() => [] as CreditGuarantee[]),
    loadFiche(row),
    loadCreditAnalysis(row.id).catch(() => null),
    clientId ? listAgentClientKycDocuments(clientId).catch(() => [] as KycDocument[]) : Promise.resolve([] as KycDocument[]),
  ]);
  const identityDocs = kycDocs.length ? kycDocs : Array.isArray(fiche?.kyc_documents) ? fiche.kyc_documents : [];
  const borrower = mergeBorrower(row, fiche);
  const income = row.declared_monthly_income;
  const expenses = row.declared_monthly_expenses;
  const disposable = income != null && expenses != null ? income - expenses : undefined;
  const score = formatScore(analysis?.overall_score);
  const confidence = formatScore(analysis?.confidence_score);
  const role = getUiSession()?.role;
  const canReview = role === 'ANALYST' || role === 'ADMIN';

  setText('analyst-drawer-ref-badge', `#${row.id}`);
  setText('analyst-drawer-title', borrower.name);
  setText('analyst-drawer-subtitle', `Fiche 360° • ${creditStatusLabel(row.status)} • ${formatFcfa(row.requested_amount)}`);
  setText('analyst-drawer-status-badge', creditStatusLabel(row.status));
  setText('analyst-drawer-score-val', score != null ? String(score) : '—');
  setHtml(
    'analyst-drawer-risk-tag',
    `<i class="fas fa-shield-halved mr-1"></i> ${scoringLabel(analysis?.recommendation)}`,
  );
  setHtml(
    'analyst-drawer-confidence',
    `Indice de Confiance : <strong class="text-emerald">${confidence != null ? `${confidence}%` : '—'}</strong>`,
  );
  setText('analyst-drawer-client-id', dash(borrower.number));
  setText('analyst-drawer-client-name', borrower.name);
  setText('analyst-drawer-client-activity', dash(borrower.occupation));
  setHtml(
    'analyst-drawer-client-loc',
    `<i class="fas fa-location-dot text-primary mr-1"></i> ${dash(borrower.location)}`,
  );
  const avatar = document.getElementById('analyst-drawer-client-avatar') as HTMLImageElement | null;
  if (avatar) {
    avatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(borrower.name)}&background=4f46e5&color=fff`;
  }
  setText('analyst-drawer-income', formatFcfa(income));
  setText('analyst-drawer-expenses', formatFcfa(expenses));
  setText('analyst-drawer-disposable', formatFcfa(disposable));
  setText('analyst-drawer-installment', formatFcfa(row.estimated_monthly_payment));
  const capBanner = document.getElementById('analyst-drawer-cap-banner');
  if (capBanner) {
    const pass = disposable != null && row.estimated_monthly_payment != null && disposable >= row.estimated_monthly_payment;
    capBanner.className = `capacity-comparison ${pass ? 'pass' : 'fail'}`;
    capBanner.textContent =
      disposable == null
        ? 'Capacité non calculée en base.'
        : pass
          ? 'Reste à vivre supérieur à la mensualité estimée.'
          : 'Reste à vivre inférieur à la mensualité estimée.';
  }
  setText('analyst-drawer-docs-count', `${docs.length} pièce${docs.length > 1 ? 's' : ''}`);
  const docsList = document.getElementById('analyst-drawer-docs-list');
  if (docsList) {
    docsList.innerHTML = docs.length
      ? docs
          .map((doc) => {
            const check = documentCheck(doc.status);
            const excerpt = doc.analysis_summary || (typeof doc.extracted_text === 'string' ? doc.extracted_text.slice(0, 110) : '');
            return `<div data-open-doc="CREDIT-${row.id}-${doc.id}" style="padding:0.5rem 0.6rem;border:1px solid var(--border-color);border-radius:var(--radius-sm);background:var(--bg-surface-secondary);cursor:pointer">
              <div style="display:flex;justify-content:space-between;gap:0.5rem;align-items:center">
                <span style="font-size:0.8rem;font-weight:600">${doc.original_filename || doc.document_type || 'Pièce'}</span>
                <span class="${check.badgeClass}" style="font-size:0.65rem">${check.label}</span>
              </div>
              <p style="margin:0.35rem 0 0;font-size:0.72rem;color:var(--text-muted)">${excerpt || 'Lecture automatique après dépôt. Cliquez pour ouvrir.'}</p>
              ${canReview ? `<div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-top:0.45rem">
                <button type="button" class="btn btn-primary btn-sm" data-doc-decision="VALIDATED" data-doc-id="${doc.id}" style="font-size:0.68rem">Conforme</button>
                <button type="button" class="btn btn-secondary btn-sm" data-doc-decision="TO_COMPLETE" data-doc-id="${doc.id}" style="font-size:0.68rem">À reprendre</button>
                <button type="button" class="btn btn-secondary btn-sm" data-doc-decision="REJECTED" data-doc-id="${doc.id}" style="font-size:0.68rem">Non conforme</button>
              </div>` : ''}
            </div>`;
          })
          .join('')
      : '<p style="margin:0;font-size:0.8rem;color:var(--text-muted)">Aucune pièce en base.</p>';
    docsList.onclick = (event) => {
      const btn = (event.target as HTMLElement).closest<HTMLElement>('[data-doc-decision]');
      if (btn) {
        event.stopPropagation();
        const documentId = Number(btn.dataset.docId);
        const decision = btn.dataset.docDecision as 'VALIDATED' | 'TO_COMPLETE' | 'REJECTED';
        void submitHumanValidationFromDrawer(decision, documentId);
        return;
      }
      const open = (event.target as HTMLElement).closest<HTMLElement>('[data-open-doc]');
      if (open?.dataset.openDoc) {
        void import('@/features/workflow/fillDocLightbox').then(({ openDocLightbox }) => openDocLightbox(open.dataset.openDoc));
      }
    };
  }
  const signals: string[] = [];
  if (!docs.length) {
    signals.push('Pièces justificatives manquantes.');
  }
  if (docs.some(isDocumentRejected)) {
    signals.push('Au moins une pièce est non conforme après contrôle.');
  }
  if (analysis?.document_score != null && analysis.document_score < 50) {
    signals.push('Le contrôle automatique des pièces est insuffisant.');
  }
  if (!guarantees.length) {
    signals.push('Aucune garantie déclarée.');
  }
  if ((row.repayment_capacity_status || '').toUpperCase() === 'INSUFFICIENT') {
    signals.push('Capacité de remboursement insuffisante.');
  }
  const analystChecks = buildDecisionChecks({
    row,
    docs,
    guarantees,
    identityDocs,
    borrowerKyc: borrower.kyc,
    disposable,
  });
  const analystNextAction = nextActionForAnalyst(analystChecks, signals.length, analysis);
  setText('analyst-drawer-next-action', analystNextAction);
  setText('analyst-drawer-decision-summary', decisionSummary(analysis, analystChecks, analystNextAction));
  setHtml('analyst-drawer-decision-checklist', renderDecisionChecklist(analystChecks.items));
  setHtml(
    'analyst-drawer-workflow-timeline',
    renderWorkflowTimeline(
      buildWorkflowTimeline({
        row,
        docs,
        guarantees,
        identityDocs,
        checks: analystChecks,
        analysis,
        target: 'analyst',
      }),
    ),
  );
  setText('analyst-drawer-timeline-badge', creditStatusLabel(row.status));
  const analystAuditEvents = buildDossierAuditTrail({ row, docs, guarantees, identityDocs, analysis, target: 'analyst' });
  setHtml('analyst-drawer-audit-trail', renderDossierAuditTrail(analystAuditEvents));
  setText('analyst-drawer-audit-badge', `${analystAuditEvents.length} trace${analystAuditEvents.length > 1 ? 's' : ''}`);
  const readinessBadge = document.getElementById('analyst-drawer-readiness-badge');
  if (readinessBadge) {
    readinessBadge.textContent = analystChecks.hasBlockingIssue || signals.length ? 'À compléter' : analystChecks.hasWarning ? 'À confirmer' : 'Prêt comité';
    readinessBadge.className = `badge ${analystChecks.hasBlockingIssue || signals.length ? 'badge-rejected' : analystChecks.hasWarning ? 'badge-warning' : 'badge-approved'}`;
    (readinessBadge as HTMLElement).style.fontSize = '0.68rem';
  }
  setText('analyst-drawer-anom-count', `${signals.length} alerte${signals.length > 1 ? 's' : ''}`);
  const anomList = document.getElementById('analyst-drawer-anomalies-list');
  if (anomList) {
    anomList.innerHTML = signals.length
      ? signals.map((item) => `<div style="font-size:0.78rem;color:#991b1b">${item}</div>`).join('')
      : '<p style="margin:0;font-size:0.8rem;color:var(--text-muted)">Aucun signal automatique.</p>';
  }
  const factors = [
    ['Capacité de remboursement', analysis?.repayment_capacity_score],
    ['Cohérence des revenus', analysis?.income_consistency_score],
    ['Activité', analysis?.activity_score],
    ['Charges', analysis?.expense_score],
    ['Contrôle des pièces', analysis?.document_score],
    ['Épargne', analysis?.savings_score],
    ['Historique crédit', analysis?.credit_history_score],
    ['Garantie', analysis?.guarantee_score],
  ] as const;
  const factorsList = document.getElementById('analyst-drawer-factors-list');
  if (factorsList) {
    factorsList.innerHTML = analysis
      ? renderDecisionFactors(factors)
      : '<p style="margin:0;font-size:0.8rem;color:var(--text-muted)">Analyse non calculée en base.</p>';
  }
  const notes = document.getElementById('analyst-drawer-notes-input') as HTMLTextAreaElement | null;
  if (notes) {
    notes.value = analysis?.analysis_summary || '';
  }
  const reco = document.getElementById('analyst-drawer-reco-select') as HTMLSelectElement | null;
  if (reco && analysis?.recommendation) {
    const key = analysis.recommendation.toUpperCase();
    reco.value = key === 'UNFAVORABLE' ? 'UNFAVORABLE' : key === 'RESERVED' ? 'RESERVED' : 'FAVORABLE';
  }
  const reviewActions = document.getElementById('analyst-drawer-review-actions');
  if (reviewActions) {
    reviewActions.style.display = canReview ? '' : 'none';
  }
  setText('modal-dossier-ref', `#${row.id}`);
  setText('modal-client-name', borrower.name);
  setText('modal-client-location', `${dash(borrower.location)} • ${dash(borrower.number)}`);
  setText('modal-score-val', score != null ? String(score) : '—');
  setText('cap-income', formatFcfa(income));
  setText('cap-expenses', formatFcfa(expenses));
  setText('cap-disposable', formatFcfa(disposable));
  setText('cap-installment', formatFcfa(row.estimated_monthly_payment));
  showBackdrop('analyst-drawer-backdrop');
}

export async function openAnalyst360FromAgent() {
  const id = getSelectedCreditRequestId();
  showBackdrop('agent-drawer-backdrop', false);
  await fillAndOpenAnalystDrawer(id ? String(id) : undefined);
}

export async function requestComplementFromAnalystDrawer() {
  const id = getSelectedCreditRequestId();
  if (!id) {
    toast.info('Aucun dossier sélectionné.');
    return;
  }
  const comment = window.prompt('Motif des compléments (min. 5 caractères) :');
  if (comment == null) {
    return;
  }
  if (comment.trim().length < 5) {
    toast.warning('Le commentaire doit contenir au moins 5 caractères.');
    return;
  }
  try {
    const role = getUiSession()?.role;
    if (role === 'ANALYST' || role === 'ADMIN') {
      await submitAnalystReview(id, {
        recommendation: 'RESERVED',
        comment: comment.trim(),
        next_step: 'VERIFICATION_REQUIRED',
      });
    } else {
      await requestComplements(id, comment.trim());
    }
    notifyRequestsChanged();
    showBackdrop('analyst-drawer-backdrop', false);
    toast.success('Compléments demandés au client.');
  } catch (error) {
    toast.danger(isApiError(error) ? error.message : 'Impossible de demander des compléments.');
  }
}

export async function submitHumanValidationFromDrawer(
  decision: 'VALIDATED' | 'TO_COMPLETE' | 'REJECTED' = 'VALIDATED',
  documentId?: number,
) {
  const id = getSelectedCreditRequestId();
  if (!id) {
    toast.info('Aucun dossier sélectionné.');
    return;
  }
  const comment =
    decision === 'VALIDATED'
      ? 'Pièces contrôlées et acceptées.'
      : decision === 'TO_COMPLETE'
        ? 'Pièce à reprendre après le contrôle automatique.'
        : 'Pièce non conforme.';
  try {
    await submitHumanValidation(id, {
      validation_type: 'DOCUMENT',
      decision,
      comment,
      ...(documentId ? { document_id: documentId } : {}),
    });
    notifyRequestsChanged();
    toast.success(
      decision === 'VALIDATED'
        ? 'Conformité des pièces enregistrée.'
        : decision === 'TO_COMPLETE'
          ? 'Le demandeur doit reprendre la pièce.'
          : 'Pièce marquée non conforme.',
    );
  } catch (error) {
    toast.danger(isApiError(error) ? error.message : 'Impossible d’enregistrer le contrôle des pièces.');
  }
}

export async function requestDocumentReworkFromDrawer() {
  await submitHumanValidationFromDrawer('TO_COMPLETE');
}

export async function fillAndOpenAnomalyDrawer(identifier?: string) {
  const { getCachedAnalystSignals } = await import('@/features/analyst/useAnalystWorkspace');
  const signals = getCachedAnalystSignals();
  const match = signals.find((item) => String(item.id) === String(identifier)) ?? signals[0];
  if (!match) {
    toast.info('Aucun point de contrôle à afficher.');
    return;
  }
  if (match.credit_request_id) {
    setSelectedCreditRequestId(match.credit_request_id);
  }
  const request = match.request;
  setText('anom-drawer-ref-badge', request ? `#${request.id}` : '—');
  setText('anom-drawer-title', match.borrower || 'Point de contrôle');
  setText('anom-drawer-subtitle', match.description || 'Vérification du dossier');
  setText('anom-drawer-type-name', match.anomaly_type || 'CONTRÔLE');
  setText('anom-drawer-client-name', match.borrower || 'Demandeur');
  setText('anom-drawer-loan-amount', formatFcfa(request?.requested_amount));
  setText('anom-drawer-desc', match.description || '—');
  setText('anom-drawer-category-badge', 'Contrôle des pièces');
  setText('anom-drawer-doc-ocr-score', 'Lecture automatique');
  setText('anom-drawer-val-detected', '—');
  setText('anom-drawer-val-expected', 'Dossier complet et pièces lisibles');
  setText('anom-drawer-doc-name', match.description || 'Pièce du dossier');
  setText('anom-drawer-doc-type', 'Contrôle après dépôt');
  setText('anom-drawer-doc-status', match.status === 'OPEN' ? 'À traiter' : match.status || 'Ouvert');
  const category = document.getElementById('anom-drawer-category-badge');
  if (category) {
    category.className = 'badge badge-submitted';
  }
  const status = document.getElementById('anom-drawer-status-badge');
  if (status) {
    status.textContent = match.status || 'Ouvert';
  }
  const hidden = document.getElementById('anom-drawer-id') as HTMLInputElement | null;
  if (hidden) {
    hidden.value = String(match.id);
  }
  showBackdrop('anomaly-drawer-backdrop');
}

export async function resolveAnomalyFromDrawer() {
  const hidden = document.getElementById('anom-drawer-id') as HTMLInputElement | null;
  const id = Number(hidden?.value);
  const comment =
    String((document.getElementById('anom-drawer-comment-input') as HTMLTextAreaElement | null)?.value ?? '').trim() ||
    'Point vérifié et levé.';
  if (!Number.isFinite(id) || id <= 0) {
    toast.info('Aucun contrôle sélectionné.');
    return;
  }
  if (comment.length < 5) {
    toast.warning('Indiquez un commentaire d’au moins 5 caractères.');
    return;
  }
  try {
    await resolveAnomaly(id, { status: 'RESOLVED', resolution_comment: comment });
    showBackdrop('anomaly-drawer-backdrop', false);
    notifyRequestsChanged();
    toast.success('Point de contrôle levé.');
  } catch (error) {
    toast.danger(isApiError(error) ? error.message : 'Ce point est lié au dossier. Ouvrez l’analyse 360° pour le traiter.');
    showBackdrop('anomaly-drawer-backdrop', false);
  }
}
