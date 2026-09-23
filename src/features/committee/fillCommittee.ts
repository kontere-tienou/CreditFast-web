import { toast } from '@heroui/react';
import { formatAmount, parseAmount, parseDecimal } from '@/shared/format/money';
import {
  getCreditRequest,
  listCreditRequestDocuments,
  listCreditRequestGuarantees,
  listCommitteeRequests,
  getCreditAnalysis,
  submitCommitteeDecision,
  type CreditAnalysis,
  type CreditDocument,
  type CreditGuarantee,
  type CreditRequest,
} from '@/api/credit';
import { isApiError } from '@/api/errors';
import {
  borrowerName,
  creditStatusLabel,
  formatDate,
  formatFcfa,
  getSelectedCreditRequestId,
  stageLockMessage,
  notifyRequestsChanged,
  setSelectedCreditRequestId,
} from '@/features/workflow/workflow';
import { isCommitteePending } from './useCommitteeWorkspace';

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

function formatScore(value?: number) {
  if (value == null || Number.isNaN(value)) {
    return null;
  }
  return Math.round(value <= 1 ? value * 100 : value);
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
  return recommendation ? recommendation : 'Avis non renseigné';
}

function analystNotes(analysis: CreditAnalysis | null, row: CreditRequest) {
  const summary = analysis?.analysis_summary?.trim() || '';
  if (summary && !/cold start|api|ocr|xai|modèle scoring/i.test(summary)) {
    return summary;
  }
  const parts = [scoringLabel(analysis?.recommendation)];
  if (row.purpose) {
    parts.push(`Objet : ${row.purpose}.`);
  }
  return parts.join(' ');
}

function recommendationTone(recommendation?: string) {
  const key = (recommendation || '').toUpperCase();
  if (key === 'FAVORABLE') {
    return { label: 'Recommandation favorable', cls: 'badge badge-approved', tone: 'is-good' };
  }
  if (key === 'RESERVED') {
    return { label: 'Recommandation réservée', cls: 'badge badge-warning', tone: 'is-warn' };
  }
  if (key === 'UNFAVORABLE') {
    return { label: 'Recommandation défavorable', cls: 'badge badge-rejected', tone: 'is-bad' };
  }
  return { label: 'Non calculée', cls: 'badge badge-submitted', tone: '' };
}

function placeScoreMarker(id: string, score: number | null, tone: string) {
  const marker = document.getElementById(id);
  if (!marker) {
    return;
  }
  if (score == null) {
    marker.style.left = '0%';
    marker.className = 'com-score-marker is-hidden';
    return;
  }
  const clamped = Math.max(0, Math.min(100, score));
  marker.style.left = `${clamped}%`;
  marker.className = `com-score-marker ${tone}`.trim();
}

type CommitteeAuditEvent = {
  title: string;
  detail: string;
  actor: string;
  date?: string | null;
  icon: string;
  state: 'done' | 'active' | 'warn';
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function latestDate(values: Array<string | null | undefined>) {
  const dates = values
    .filter((value): value is string => Boolean(value))
    .map((value) => ({ value, time: Date.parse(value) }))
    .filter((item) => Number.isFinite(item.time))
    .sort((left, right) => right.time - left.time);
  return dates[0]?.value ?? values.find(Boolean) ?? null;
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

function isVerifiedStatus(status?: string | null) {
  return ['VERIFIED', 'VALIDATED', 'APPROVED', 'CONFORME', 'ACCEPTED'].includes((status || '').toUpperCase());
}

function isRejectedStatus(status?: string | null) {
  return ['REJECTED', 'FAILED', 'INVALID', 'ERROR'].includes((status || '').toUpperCase());
}

function isFinalDecision(row: CreditRequest) {
  return ['APPROVED', 'REJECTED', 'AMENDED', 'ADJOURNED'].includes((row.status || '').toUpperCase());
}

function renderCommitteeAuditTrail(events: CommitteeAuditEvent[]) {
  if (!events.length) {
    return '<div class="reminder-empty">Aucun événement audit disponible pour ce dossier.</div>';
  }
  return events
    .map(
      (event) => `<div class="audit-event is-${event.state}">
        <span class="audit-event-icon"><i class="fas ${event.icon}"></i></span>
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

function buildCommitteeAuditTrail(row: CreditRequest, analysis: CreditAnalysis | null, docs: CreditDocument[], guarantees: CreditGuarantee[]) {
  const docsDate = latestDate(docs.map((doc) => doc.uploaded_at));
  const rejectedDocs = docs.filter((doc) => isRejectedStatus(doc.status)).length;
  const guaranteeDate = latestDate(guarantees.map((item) => item.verified_at || item.created_at));
  const guaranteeVerified = guarantees.some((item) => isVerifiedStatus(item.verification_status));
  const score = formatScore(analysis?.overall_score);

  const events: CommitteeAuditEvent[] = [
    {
      title: 'Dossier déposé',
      detail: `Demande #${row.id} soumise pour ${formatFcfa(row.requested_amount)}${row.duration_months ? ` sur ${row.duration_months} mois` : ''}.`,
      actor: 'Client',
      date: row.submitted_at || row.created_at,
      icon: 'fa-file-circle-plus',
      state: row.submitted_at || row.created_at ? 'done' : 'active',
    },
    {
      title: 'Justificatifs contrôlés',
      detail: docs.length
        ? `${docs.length} pièce${docs.length > 1 ? 's' : ''} de dossier disponible${docs.length > 1 ? 's' : ''}${rejectedDocs ? `, ${rejectedDocs} non conforme${rejectedDocs > 1 ? 's' : ''}` : ''}.`
        : 'Aucune pièce de dossier remontée dans la file comité.',
      actor: 'Agent / Analyste',
      date: docsDate,
      icon: rejectedDocs ? 'fa-file-circle-exclamation' : 'fa-file-shield',
      state: rejectedDocs || !docs.length ? 'warn' : 'done',
    },
    {
      title: 'Garantie instruite',
      detail: guarantees.length
        ? guaranteeVerified
          ? 'Garantie présente et vérifiée avant décision.'
          : 'Garantie présente mais contrôle terrain à confirmer dans les réserves.'
        : 'Aucune garantie déclarée dans le dossier.',
      actor: 'Agent terrain',
      date: guaranteeDate,
      icon: 'fa-shield-halved',
      state: guaranteeVerified ? 'done' : 'warn',
    },
    {
      title: 'Score calculé à l’arrivée au comité',
      detail: analysis
        ? `Score ${score ?? '—'}/100. ${recommendationTone(analysis.recommendation).label}.`
        : 'Le score est calculé quand le dossier arrive au comité.',
      actor: 'Comité',
      date: analysis?.created_at,
      icon: 'fa-chart-line',
      state: analysis ? 'done' : 'warn',
    },
    {
      title: isFinalDecision(row) ? 'Décision comité' : 'Dossier prêt pour vote',
      detail: isFinalDecision(row)
        ? `Décision enregistrée : ${creditStatusLabel(row.status)}.`
        : 'Le comité peut approuver, refuser ou amender le montant et la durée.',
      actor: 'Comité de crédit',
      date: null,
      icon: 'fa-gavel',
      state: isFinalDecision(row) ? 'done' : 'active',
    },
  ];

  if (row.loan_id || row.loan?.id) {
    events.push({
      title: 'Prêt créé après décision',
      detail: `Prêt #${row.loan_id ?? row.loan?.id} : le montant est versé sur le compte épargne et l’échéancier est lancé.`,
      actor: 'Back-office',
      date: null,
      icon: 'fa-file-contract',
      state: 'done',
    });
  }

  return events;
}

function fieldNumber(id: string, fallback?: number) {
  const node = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
  const value = id === 'com-interest-rate' ? parseDecimal(node?.value) : parseAmount(node?.value);
  if (value != null && value > 0) {
    return value;
  }
  return fallback;
}

function fieldText(id: string) {
  const node = document.getElementById(id) as HTMLInputElement | null;
  return node?.value?.trim() || '';
}

async function loadRequest(id: number) {
  try {
    return await getCreditRequest(id);
  } catch {
    const rows = await listCommitteeRequests().catch(() => [] as CreditRequest[]);
    return rows.find((row) => row.id === id) ?? null;
  }
}

function borrowerLocation(row: CreditRequest) {
  return row.client?.city || row.client?.residential_zone || row.client?.address || '';
}

function setBar(id: string, value: number | null) {
  const bar = document.getElementById(id);
  if (!bar) {
    return;
  }
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value));
  bar.style.width = `${pct}%`;
}

function bindLiveEstimate(row: CreditRequest) {
  const update = () => {
    const amount = fieldNumber('com-approved-amount', row.requested_amount) ?? 0;
    const duration = fieldNumber('com-approved-duration', row.duration_months) ?? 12;
    const rate = fieldNumber('com-interest-rate', 15) ?? 15;
    const monthly =
      duration > 0 ? Math.round((amount * (1 + (rate / 100) * (duration / 12))) / duration) : 0;
    const income = row.declared_monthly_income ?? 0;
    const effort = income > 0 ? ((monthly / income) * 100).toFixed(1) : '—';
    setText('com-live-monthly-payment', `${formatFcfa(monthly)} / mois`);
    const ratioEl = document.getElementById('com-live-effort-ratio');
    if (ratioEl) {
      ratioEl.textContent = effort === '—' ? '—' : `${effort}%`;
      const n = Number(effort);
      ratioEl.style.color = !Number.isFinite(n) || n <= 33 ? '#518e45' : '#b45309';
    }
  };
  ['com-approved-amount', 'com-approved-duration', 'com-interest-rate'].forEach((id) => {
    const node = document.getElementById(id) as HTMLElement | null;
    if (!node || node.dataset.bound === '1') {
      return;
    }
    node.addEventListener('input', update);
    node.addEventListener('change', update);
    node.dataset.bound = '1';
  });
  update();
}

function fillShared(row: CreditRequest, analysis: CreditAnalysis | null, docs: CreditDocument[] = [], guarantees: CreditGuarantee[] = []) {
  const name = borrowerName(row);
  const location = dash(borrowerLocation(row));
  const score = formatScore(analysis?.overall_score);
  const confidence = formatScore(analysis?.confidence_score);
  const income = row.declared_monthly_income;
  const expenses = row.declared_monthly_expenses;
  const disposable = income != null && expenses != null ? income - expenses : undefined;
  const recommendation = recommendationTone(analysis?.recommendation);
  const cashflow = formatScore(analysis?.repayment_capacity_score ?? analysis?.income_consistency_score);
  const guarantee = formatScore(analysis?.guarantee_score);
  const stability = formatScore(analysis?.credit_history_score ?? analysis?.activity_score);

  setText('com-dossier-num', `#${row.id}`);
  setHtml('com-client-name', `<i class="fas fa-user mr-1"></i> ${name}${location !== '—' ? ` (${location})` : ''}`);
  setText('com-requested-amount', formatFcfa(row.requested_amount));
  setText('com-requested-duration', row.duration_months ? `${row.duration_months} mois` : '—');
  setText('com-score-value', score != null ? String(score) : '—');
  setHtml('com-risk-level', recommendation.label);
  const riskEl = document.getElementById('com-risk-level');
  if (riskEl) {
    riskEl.className = `com-score-reco ${recommendation.tone}`.trim();
  }
  placeScoreMarker('com-score-marker', score, recommendation.tone);
  const gauge = document.getElementById('com-score-gauge');
  if (gauge) {
    gauge.setAttribute('aria-label', score != null ? `Score ${score} sur 100. ${recommendation.label}.` : 'Score non calculé.');
  }
  setText('com-disposable-income', formatFcfa(disposable));
  setText(
    'com-analyst-notes',
    analystNotes(analysis, row),
  );

  const amountInput = document.getElementById('com-approved-amount') as HTMLInputElement | null;
  if (amountInput) {
    amountInput.value = row.requested_amount != null ? formatAmount(row.requested_amount) : '';
  }
  const durationSelect = document.getElementById('com-approved-duration') as HTMLSelectElement | null;
  if (durationSelect && row.duration_months) {
    const value = String(row.duration_months);
    if (![...durationSelect.options].some((option) => option.value === value)) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = `${row.duration_months} mois`;
      durationSelect.appendChild(option);
    }
    durationSelect.value = value;
  }
  const conditions = document.getElementById('com-conditions') as HTMLInputElement | null;
  if (conditions && !conditions.value) {
    conditions.value = '';
    conditions.placeholder = 'Motif ou conditions (au moins 5 caractères)';
  }
  const rateInput = document.getElementById('com-interest-rate') as HTMLInputElement | null;
  if (rateInput) {
    rateInput.value = String(row.interest_rate ?? 15);
  }
  const consulting = !isCommitteePending(row.status);
  for (const id of ['com-approved-amount', 'com-approved-duration', 'com-interest-rate', 'com-conditions']) {
    const field = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
    if (field) field.disabled = consulting;
  }
  const consultation = document.getElementById('com-consultation-note');
  if (consultation) {
    consultation.hidden = !consulting;
    const status = (row.status || '').toUpperCase();
    consultation.textContent = status === 'ADJOURNED'
      ? `Dossier ajourné. Pourquoi : ${row.adjourn_reason || '—'}. Quoi : ${row.adjourn_what || '—'}.`
      : 'Ce dossier est déjà décidé. Il reste ouvert pour consultation : score, versement et échéancier.';
  }

  setText('com-drawer-req-badge', `#${row.id}`);
  setHtml('com-drawer-risk-badge', `<i class="fas fa-shield-halved"></i> ${recommendation.label}`);
  const drawerRisk = document.getElementById('com-drawer-risk-badge');
  if (drawerRisk) {
    drawerRisk.className = recommendation.cls;
  }
  setText('com-drawer-title', name);
  setText('com-drawer-subtitle', `Dossier • ${creditStatusLabel(row.status)} • ${formatFcfa(row.requested_amount)}`);
  setText('com-drawer-client-id', row.client_id ? `ID ${row.client_id}` : '—');
  setText('com-drawer-client-name', name);
  setHtml('com-drawer-location', `<i class="fas fa-location-dot text-primary mr-1"></i> ${location}`);
  const avatar = document.getElementById('com-drawer-avatar') as HTMLImageElement | null;
  if (avatar) {
    avatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1b4332&color=fff`;
  }
  setText('com-drawer-amount', formatFcfa(row.requested_amount));
  setText('com-drawer-duration', row.duration_months ? `Durée : ${row.duration_months} mois` : 'Durée : —');
  setText('com-drawer-installment', formatFcfa(row.estimated_monthly_payment));
  setText('com-drawer-activity', dash(row.purpose || row.client?.occupation));
  setText('com-drawer-surplus', formatFcfa(disposable));
  setHtml(
    'com-drawer-conf-badge',
    `<i class="fas fa-check-double"></i> Confiance ${confidence != null ? `${confidence}%` : '—'}`,
  );
  setText('com-drawer-overall-score', score != null ? String(score) : '—');
  setHtml('com-drawer-recommendation', recommendation.label);
  const drawerRecommendation = document.getElementById('com-drawer-recommendation');
  if (drawerRecommendation) {
    drawerRecommendation.className = `com-score-reco ${recommendation.tone}`.trim();
  }
  placeScoreMarker('com-drawer-score-marker', score, recommendation.tone);
  setText('com-drawer-pillar-cashflow', cashflow != null ? `${cashflow} / 100` : '—');
  setText('com-drawer-pillar-coldstart', guarantee != null ? `${guarantee} / 100` : '—');
  setText('com-drawer-pillar-stability', stability != null ? `${stability} / 100` : '—');
  setBar('com-drawer-bar-cashflow', cashflow);
  setBar('com-drawer-bar-coldstart', guarantee);
  setBar('com-drawer-bar-stability', stability);

  const auditEvents = buildCommitteeAuditTrail(row, analysis, docs, guarantees);
  setHtml('com-drawer-audit-trail', renderCommitteeAuditTrail(auditEvents));
  setText('com-drawer-audit-badge', `${auditEvents.length} trace${auditEvents.length > 1 ? 's' : ''}`);
  const committeeLock = stageLockMessage(row.status, 'committee');
  const vote = document.getElementById('com-drawer-btn-vote') as HTMLButtonElement | null;
  if (vote) {
    vote.disabled = Boolean(committeeLock);
    vote.classList.toggle('is-stage-locked', Boolean(committeeLock));
    vote.title = committeeLock || '';
  }
  const committeeNote = document.getElementById('com-drawer-lock');
  if (committeeNote) {
    committeeNote.hidden = !committeeLock;
    committeeNote.textContent = committeeLock || '';
  }

  const voteGrid = document.querySelector('.committee-decision-cards-grid') as HTMLElement | null;
  if (voteGrid) {
    voteGrid.style.opacity = isCommitteePending(row.status) ? '1' : '0.55';
    voteGrid.style.pointerEvents = isCommitteePending(row.status) ? 'auto' : 'none';
  }

  bindLiveEstimate(row);
}

export async function fillAndOpenCommitteeDrawer(identifier?: string) {
  const parsed = Number(identifier);
  const selected = Number.isFinite(parsed) && parsed > 0 ? parsed : getSelectedCreditRequestId();
  if (!selected) {
    toast.info('Aucun dossier sélectionné.');
    return;
  }
  const row = await loadRequest(selected);
  if (!row) {
    toast.info('Dossier introuvable.');
    return;
  }
  setSelectedCreditRequestId(row.id);
  const [analysis, docs, guarantees] = await Promise.all([
    getCreditAnalysis(row.id).catch(() => null),
    listCreditRequestDocuments(row.id).catch(() => [] as CreditDocument[]),
    listCreditRequestGuarantees(row.id).catch(() => [] as CreditGuarantee[]),
  ]);
  fillShared(row, analysis, docs, guarantees);
  showBackdrop('committee-drawer-backdrop');
}

export async function fillAndOpenCommitteeModal(identifier?: string) {
  const parsed = Number(identifier);
  const selected = Number.isFinite(parsed) && parsed > 0 ? parsed : getSelectedCreditRequestId();
  if (!selected) {
    toast.info('Aucun dossier sélectionné.');
    return;
  }
  const row = await loadRequest(selected);
  if (!row) {
    toast.info('Dossier introuvable.');
    return;
  }
  setSelectedCreditRequestId(row.id);
  const [analysis, docs, guarantees] = await Promise.all([
    getCreditAnalysis(row.id).catch(() => null),
    listCreditRequestDocuments(row.id).catch(() => [] as CreditDocument[]),
    listCreditRequestGuarantees(row.id).catch(() => [] as CreditGuarantee[]),
  ]);
  fillShared(row, analysis, docs, guarantees);
  showBackdrop('committee-drawer-backdrop', false);
  showBackdrop('committee-modal');
}

export function closeCommitteeDrawer() {
  showBackdrop('committee-drawer-backdrop', false);
}

export function closeCommitteeModal() {
  showBackdrop('committee-modal', false);
}

export async function openCommitteeModalFromDrawer() {
  const id = getSelectedCreditRequestId();
  await fillAndOpenCommitteeModal(id ? String(id) : undefined);
}

export async function openFirstPendingCommitteeVote() {
  const rows = await listCommitteeRequests().catch(() => [] as CreditRequest[]);
  const first = rows.find((row) => isCommitteePending(row.status)) ?? rows[0];
  if (!first) {
    toast.info('Aucun dossier en attente de vote.');
    return;
  }
  await fillAndOpenCommitteeModal(String(first.id));
}

let deciding = false;

export async function submitCommitteeDecisionFromModal(rawDecision?: string) {
  if (deciding) {
    return;
  }
  const id = getSelectedCreditRequestId();
  if (!id) {
    toast.info('Ouvrez d’abord un dossier.');
    return;
  }
  const row = await loadRequest(id);
  if (!row) {
    toast.info('Dossier introuvable.');
    return;
  }
  if (!isCommitteePending(row.status)) {
    toast.info(stageLockMessage(row.status, 'committee') || 'Ce dossier a déjà été tranché.');
    return;
  }

  const amount = fieldNumber('com-approved-amount', row.requested_amount);
  const duration = fieldNumber('com-approved-duration', row.duration_months);
  let comment = fieldText('com-conditions');
  const intent = (rawDecision || 'APPROVED').toUpperCase();

  let decision: 'APPROVED' | 'REJECTED' | 'AMENDED' = 'APPROVED';
  if (intent === 'REJECTED') {
    decision = 'REJECTED';
    if (comment.length < 5) {
      comment = 'Refus du comité de crédit.';
    }
  } else if (intent === 'AMENDED' || intent === 'RESERVED') {
    const sameAmount = amount != null && row.requested_amount != null && amount === row.requested_amount;
    const sameDuration = duration != null && row.duration_months != null && duration === row.duration_months;
    decision = sameAmount && sameDuration ? 'APPROVED' : 'AMENDED';
    if (comment.length < 5) {
      comment = decision === 'AMENDED' ? 'Accord du comité avec conditions ajustées.' : 'Accord du comité.';
    }
  } else {
    const sameAmount = amount != null && row.requested_amount != null && amount === row.requested_amount;
    const sameDuration = duration != null && row.duration_months != null && duration === row.duration_months;
    decision = sameAmount && sameDuration ? 'APPROVED' : 'AMENDED';
    if (comment.length < 5) {
      comment = decision === 'AMENDED' ? 'Accord du comité avec montant ou durée ajustés.' : 'Accord du comité.';
    }
  }

  try {
    deciding = true;
    await submitCommitteeDecision(id, {
      decision,
      comment,
      ...(decision === 'REJECTED'
        ? {}
        : {
            approved_amount: amount,
            approved_duration_months: duration,
          }),
    });
    closeCommitteeModal();
    closeCommitteeDrawer();
    notifyRequestsChanged();
    const labels = {
      APPROVED: 'Crédit accordé aux conditions demandées.',
      AMENDED: 'Crédit accordé avec les conditions ajustées.',
      REJECTED: 'Dossier refusé par le comité.',
    };
    toast.success(labels[decision]);
  } catch (error) {
    toast.danger(isApiError(error) ? error.message : 'La décision n’a pas pu être enregistrée.');
  } finally {
    deciding = false;
  }
}
