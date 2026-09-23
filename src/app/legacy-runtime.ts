import { ROLE_PROFILES, VIEW_PATHS } from '@/app/roles';
import { getUiSession } from '@/app/session';
import { formatAmount } from '@/shared/format/money';
import { toast } from '@heroui/react';
import { fetchClientProfile, hasActiveSavingsAccount, hasRequiredIdentityDocument, listKycDocuments } from '@/api/profile';
import { readSavingsSession, writeSavingsSession, clearSavingsSession, type LoanIntent } from '@/features/savings/workflow';

type LegacyApp = {
  currentRole?: string;
  currentView?: string;
  currentUser?: { name?: string; role?: string; email?: string };
  switchView?: (viewId: string) => void;
  openNewLoanModal?: (prefill?: {
    amount?: number | string;
    duration?: number | string;
    purpose?: string;
    income?: number;
    expenses?: number;
  }) => void | Promise<boolean>;
  closeNewLoanModal?: () => void;
  setModalWizardStep?: (step: number) => void;
  handleWizardProfileModeChange?: (mode: string) => void;
  submitNewCreditRequest?: () => void;
  submitAnalystReviewFromDrawer?: () => void;
  sendSelectedRequestToAnalysis?: () => void;
  requestComplementsFromAgentDrawer?: () => void;
  triggerReminderFromDrawer?: () => void;
  markDocReceivedFromDrawer?: () => void;
  triggerDrawerFileUpload?: () => void;
  openAnalyst360FromAgent?: () => void;
  openAnalyst360Modal?: () => void;
  openAnalystDossierDrawer?: (identifier?: string) => void;
  requestComplementFromAnalystDrawer?: () => void;
  submitHumanValidationFromDrawer?: (...args: unknown[]) => void;
  requestDocumentReworkFromDrawer?: () => void;
  openAnomalyDrawer?: (identifier?: string) => void;
  closeAnomalyDrawer?: () => void;
  resolveAnomalyFromDrawer?: () => void;
  saveInspectionReport?: () => void;
  openInspectionModalFromDrawer?: () => void;
  closeAnalystDossierDrawer?: () => void;
  closeAgentDrawer?: () => void;
  openCommitteeDrawer?: (identifier?: string) => void;
  closeCommitteeDrawer?: () => void;
  openCommitteeModal?: (identifier?: string) => void;
  openCommitteeVote?: (identifier?: string) => void;
  closeCommitteeModal?: () => void;
  openCommitteeModalFromDrawer?: () => void;
  openFirstPendingCommitteeVote?: () => void;
  submitCommitteeDecision?: (decision?: string) => void;
  closeModal?: (id: string) => void;
  downloadAllSignedPvsCsv?: () => void;
  openAgentDrawer?: (identifier?: string) => void;
  openInspectionDrawer?: (identifier?: string) => void;
  openInspectionFromAgentDrawer?: () => void;
  closeInspectionDrawer?: () => void;
  openComplementsDrawer?: (identifier?: string) => void;
  closeComplementsDrawer?: () => void;
  updateWizardCalculation?: () => void;
  openLogoutConfirmModal?: () => void;
  logout?: () => void;
  confirmLogout?: () => void;
  showToast?: (message: string, type?: string) => void;
  renderBorrowerDashboard?: () => void;
  updateCompactEstimator?: () => void;
  checkAndHighlightExpiringDocs?: () => void;
  renderClientSchedule?: (filter?: string) => void;
  applyFromSimulation?: () => void;
  updateClientSimulation?: () => void;
  renderAgentDashboard?: () => void;
  renderAgentInspections?: () => void;
  renderAgentClientsPortfolio?: () => void;
  renderAgentComplements?: () => void;
  renderAnalystDashboard?: () => void;
  renderAnalystAnomalies?: () => void;
  renderCommitteeDashboard?: () => void;
  renderCommitteeDossiersPage?: () => void;
  renderSignedPvTable?: () => void;
  updateColdStartComparisonSim?: () => void;
  renderAuditLogs?: () => void;
  initClientWizard?: () => void;
  openUploadDocumentModal?: () => void;
  closeUploadDocumentModal?: () => void;
  openClientRequestDrawer?: (identifier?: string) => void;
  closeClientRequestDrawer?: () => void;
  openScheduleDrawer?: (identifier?: string) => void;
  closeScheduleDrawer?: () => void;
  openClientPaymentModal?: (...args: unknown[]) => void;
  closeClientPaymentModal?: () => void;
  submitClientPayment?: (event?: Event) => void;
  applyFromCompactEstimator?: () => void;
  setCompactPresetAmount?: (amount: number) => void;
  setCompactPresetDuration?: (months: number) => void;
  downloadSimulatedAmortizationPdf?: () => void;
  saveDraftCreditRequest?: () => void;
  resumeDraftCreditRequest?: (identifier?: string | number) => void;
  deleteDraftCreditRequest?: (identifier?: string | number) => void;
  filterClientDocs?: (category: string, buttonEl?: Element | null) => void;
  handleClientDocUpload?: (event: Event) => void;
  handleClientDocDrop?: (event: Event) => void;
  openDocLightbox?: (identifier?: unknown) => void;
  closeDocLightbox?: () => void;
  zoomDocLightbox?: (factor?: unknown) => void;
  resetDocLightboxZoom?: () => void;
  rotateDocLightbox?: () => void;
  downloadDocLightbox?: () => void;
};

declare global {
  interface Window {
    __CREDITFAST_SPA__?: boolean;
    App?: LegacyApp;
    AppCharts?: { setupDefaults?: () => void };
    APP_CONSTANTS?: Record<string, unknown>;
  }
}

let capturedOpenLoan: LegacyApp['openNewLoanModal'];

export function patchLegacyApp(navigate: (path: string) => void): void {
  window.__CREDITFAST_SPA__ = true;
  const app: LegacyApp = window.App ?? {};
  const originalToast = app.showToast?.bind(app);

  const showBackdrop = (id: string, visible: boolean) => {
    const modal = document.getElementById(id);
    if (!modal) {
      return;
    }
    if (visible) {
      modal.style.display = 'flex';
      window.requestAnimationFrame(() => modal.classList.add('active'));
      return;
    }
    modal.classList.remove('active');
    window.setTimeout(() => {
      modal.style.display = 'none';
    }, 200);
  };

  const fieldValue = (id: string) =>
    String((document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null)?.value ?? '').trim();

  const fieldNumber = (id: string, fallback = 0) => {
    const value = Number(fieldValue(id).replace(/\s/g, ''));
    return Number.isFinite(value) ? value : fallback;
  };

  const setFieldValue = (id: string, value: unknown) => {
    const field = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
    if (!field || value == null || value === '') {
      return;
    }
    field.value = String(value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const formatLocalFcfa = (value: number) => `${formatAmount(value)} FCFA`;

  const ensureWizardCalculationListeners = () => {
    ['wiz-income', 'wiz-expenses', 'wiz-debt', 'wiz-amount', 'wiz-duration'].forEach((id) => {
      const field = document.getElementById(id) as HTMLInputElement | null;
      if (!field || field.dataset.cfWizardBound === '1') {
        return;
      }
      field.dataset.cfWizardBound = '1';
      field.addEventListener('input', () => app.updateWizardCalculation?.());
    });
  };

  const applyLoanModalBranding = () => {
    const role = getUiSession()?.role ?? app.currentRole;
    const title = document.getElementById('modal-loan-app-title');
    const badge = document.getElementById('modal-loan-app-badge');
    const subtitle = document.getElementById('modal-loan-app-subtitle');
    const submit = document.getElementById('modal-loan-app-submit-btn');
    const header = document.getElementById('modal-loan-app-header') as HTMLElement | null;

    if (role === 'CREDIT_OFFICER') {
      if (title) title.textContent = 'Enregistrer une Demande de Prêt (Guichet)';
      if (badge) badge.textContent = 'Agent de Crédit';
      if (subtitle) subtitle.textContent = 'Saisie de dossier pour un sociétaire, vérification KYC & transmission au pôle risque';
      if (submit) submit.innerHTML = '<i class="fas fa-paper-plane mr-2"></i> Enregistrer & Transmettre au Pôle Risque';
      if (header) header.style.background = 'linear-gradient(135deg, #0284c7, #0369a1)';
      return;
    }

    if (title) title.textContent = 'Faire une Demande de Prêt CreditFast';
    if (badge) badge.textContent = 'Parcours 6 Étapes';
    if (subtitle) subtitle.textContent = 'Instruction rapide, calcul transparent de votre mensualité & transmission sécurisée à votre conseiller';
    if (submit) submit.innerHTML = '<i class="fas fa-paper-plane mr-2"></i> Confirmer & Soumettre ma Demande';
    if (header) header.style.background = 'linear-gradient(135deg, var(--cif-emerald-600, #518e45), var(--cif-emerald-700, #1b4332))';
  };

  app.openUploadDocumentModal = () => showBackdrop('modal-upload-document', true);
  app.closeUploadDocumentModal = () => showBackdrop('modal-upload-document', false);
  app.closeClientRequestDrawer = () => showBackdrop('client-request-drawer-backdrop', false);
  app.renderBorrowerDashboard = () => {
    app.updateCompactEstimator?.();
  };
  app.renderClientSchedule = () => undefined;
  app.checkAndHighlightExpiringDocs = () => undefined;
  app.renderAgentDashboard = () => undefined;
  app.renderAgentInspections = () => undefined;
  app.renderAgentClientsPortfolio = () => undefined;
  app.renderAgentComplements = () => undefined;
  app.closeAgentDrawer = () => showBackdrop('agent-drawer-backdrop', false);
  app.closeAnalystDossierDrawer = () => showBackdrop('analyst-drawer-backdrop', false);
  app.closeInspectionDrawer = () => showBackdrop('inspection-drawer-backdrop', false);
  app.closeComplementsDrawer = () => showBackdrop('complements-drawer-backdrop', false);
  app.openScheduleDrawer = (identifier) => {
    void import('@/features/loans/postOctroi').then(({ fillAndOpenScheduleDrawer }) => fillAndOpenScheduleDrawer(identifier));
  };
  app.closeScheduleDrawer = () => {
    void import('@/features/loans/postOctroi').then(({ closeScheduleDrawer }) => closeScheduleDrawer());
  };
  app.openClientPaymentModal = (...args) => {
    void import('@/features/loans/postOctroi').then(({ openClientPaymentModal }) => openClientPaymentModal(args[0]));
  };
  app.closeClientPaymentModal = () => {
    void import('@/features/loans/postOctroi').then(({ closeClientPaymentModal }) => closeClientPaymentModal());
  };
  app.submitClientPayment = (event) => {
    event?.preventDefault();
    void import('@/features/loans/postOctroi').then(({ submitClientPayment }) => submitClientPayment(event));
  };
  if (!capturedOpenLoan && app.openNewLoanModal) {
    capturedOpenLoan = app.openNewLoanModal.bind(app);
  }
  app.setModalWizardStep = (step) => {
    const nextStep = Math.max(1, Math.min(6, Number(step) || 1));
    document.querySelectorAll<HTMLElement>('.modal-wizard-step-content').forEach((node) => {
      node.style.display = 'none';
    });
    const activeContent = document.getElementById(`modal-wizard-step-${nextStep}`);
    if (activeContent) {
      activeContent.style.display = 'block';
    }
    document.querySelectorAll<HTMLElement>('[id^="modal-wstep-"]').forEach((node, index) => {
      const current = index + 1;
      node.classList.toggle('active', current === nextStep);
      node.classList.toggle('completed', current < nextStep);
    });
    app.updateWizardCalculation?.();
  };
  app.updateWizardCalculation = () => {
    const income = fieldNumber('wiz-income', 0);
    const expenses = fieldNumber('wiz-expenses', 0);
    const debt = fieldNumber('wiz-debt', 0);
    const amount = fieldNumber('wiz-amount', 2500000);
    const months = Math.max(1, fieldNumber('wiz-duration', 12));
    const principal = Math.max(0, amount);
    const totalRate = Math.max(0.06, Math.min(0.22, months * 0.012));
    const installment = principal > 0 ? Math.ceil((principal * (1 + totalRate)) / months) : 0;
    const disposable = income - expenses - debt;
    const restAfterPayment = disposable - installment;
    const sufficient = installment > 0 && disposable > 0 && restAfterPayment >= Math.max(0, income * 0.2);

    const disposableNode = document.getElementById('wiz-calc-disposable');
    const installmentNode = document.getElementById('wiz-calc-installment');
    const statusNode = document.getElementById('wiz-calc-status');
    if (disposableNode) {
      disposableNode.textContent = disposable > 0 ? formatLocalFcfa(disposable) : '—';
    }
    if (installmentNode) {
      installmentNode.textContent = installment > 0 ? formatLocalFcfa(installment) : '—';
    }
    if (statusNode) {
      statusNode.className = `badge ${sufficient ? 'badge-capacity-sufficient' : 'badge-capacity-insufficient'}`;
      statusNode.textContent = sufficient ? 'Mensualité compatible' : 'À revoir';
    }
  };
  app.handleWizardProfileModeChange = (mode) => {
    const isCold = mode === 'COLD_START';
    const standard = document.getElementById('modal-label-profile-standard') as HTMLElement | null;
    const cold = document.getElementById('modal-label-profile-coldstart') as HTMLElement | null;
    const indicator = document.getElementById('modal-wiz-cold-start-indicator');
    const info = document.getElementById('modal-wiz-cold-start-info');
    if (standard && cold) {
      standard.style.borderColor = isCold ? 'var(--border-color)' : 'var(--primary-600)';
      standard.style.background = isCold ? 'var(--bg-surface)' : 'var(--cif-primary-50, #eff6ff)';
      cold.style.borderColor = isCold ? 'var(--primary-600)' : 'var(--border-color)';
      cold.style.background = isCold ? 'var(--cif-emerald-50, #eef4ee)' : 'var(--bg-surface)';
    }
    if (indicator) {
      indicator.className = isCold ? 'badge badge-warning' : 'badge badge-submitted';
      indicator.innerHTML = isCold
        ? '<i class="fas fa-check"></i> Mode Cold Start Activé'
        : '<i class="fas fa-landmark"></i> Membre existant';
    }
    if (info) {
      info.innerHTML = isCold
        ? '<i class="fas fa-balance-scale text-emerald mr-1"></i> <strong>Modèle d\\\'Inclusion CreditFast:</strong> L\\\'absence d\\\'historique n\\\'est pas pénalisée. Les pondérations s\\\'adaptent à votre capacité réelle de remboursement et à vos garanties de proximité.'
        : '<i class="fas fa-piggy-bank text-primary mr-1"></i> <strong>Historique disponible:</strong> Le score peut tenir compte de l\\\'épargne, des remboursements passés et de la stabilité du compte.';
    }
  };
  app.initClientWizard = () => {
    ensureWizardCalculationListeners();
    app.setModalWizardStep?.(1);
  };
  let checkingSavings = false;
  app.openNewLoanModal = async (prefill) => {
    if (checkingSavings) return false;
    const savingsOwner = getUiSession()?.userId || getUiSession()?.identifier || '';
    if (getUiSession()?.role === 'CLIENT') {
      checkingSavings = true;
      const token = getUiSession()?.token;
      try {
        const profile = await fetchClientProfile();
        if (getUiSession()?.token !== token) return false;
        if (!hasActiveSavingsAccount(profile)) {
          if (prefill) writeSavingsSession(savingsOwner, 'loan', prefill);
          window.dispatchEvent(new Event('creditfast:open-savings-membership'));
          return false;
        }
        const documents = await listKycDocuments();
        if (getUiSession()?.token !== token) return false;
        if (!hasRequiredIdentityDocument(documents)) {
          if (prefill) writeSavingsSession(savingsOwner, 'loan', prefill);
          toast.warning('Une pièce d’identité est obligatoire pour compléter votre profil CreditFast.');
          navigate('/app/client/documents');
          return false;
        }
      } catch {
        toast.danger('Impossible de vérifier votre compte épargne. Réessayez avant de faire une demande de prêt.');
        return false;
      } finally { checkingSavings = false; }
    }
    const modal = document.getElementById('modal-loan-application');
    if (!modal) {
      toast.warning('Le formulaire de demande n’est pas encore chargé.');
      return false;
    }
    ensureWizardCalculationListeners();
    prefill = prefill ?? readSavingsSession<LoanIntent>(savingsOwner, 'loan') ?? undefined;
    applyLoanModalBranding();
    app.setModalWizardStep?.(1);
    setFieldValue('wiz-amount', prefill?.amount);
    setFieldValue('wiz-duration', prefill?.duration);
    setFieldValue('wiz-purpose', prefill?.purpose);
    showBackdrop('modal-loan-application', true);
    clearSavingsSession(savingsOwner, 'loan');
    app.updateWizardCalculation?.();
    await import('@/features/client/persistFiche').then(({ hydrateWizardFromProfile }) => hydrateWizardFromProfile()).catch(() => {
      toast.warning('Certaines informations du profil n’ont pas pu être préremplies.');
    });
    return true;
  };
  app.closeNewLoanModal = () => showBackdrop('modal-loan-application', false);
  app.updateCompactEstimator = () => {
    void import('@/features/client/runSimulation').then(({ scheduleCompactEstimator }) => scheduleCompactEstimator());
  };
  app.setCompactPresetAmount = (amount) => {
    const slider = document.getElementById('compact-est-amount-range') as HTMLInputElement | null;
    if (slider) {
      slider.value = String(amount);
    }
    app.updateCompactEstimator?.();
  };
  app.setCompactPresetDuration = (months) => {
    const slider = document.getElementById('compact-est-duration-range') as HTMLInputElement | null;
    if (slider) {
      slider.value = String(months);
    }
    app.updateCompactEstimator?.();
  };
  app.applyFromCompactEstimator = () => {
    void import('@/features/client/runSimulation').then(({ applyFromCompactEstimator }) => {
      applyFromCompactEstimator((prefill) => app.openNewLoanModal?.(prefill));
    });
  };
  app.downloadSimulatedAmortizationPdf = () => {
    toast.info('L’export PDF n’est pas disponible. Les mensualités affichées viennent du calcul du dossier.');
  };
  app.updateClientSimulation = () => {
    void import('@/features/client/runSimulation').then(({ scheduleClientSimulation }) => scheduleClientSimulation());
  };
  app.applyFromSimulation = () => {
    void import('@/features/client/runSimulation').then(({ applySimulationToLoan }) => {
      applySimulationToLoan((prefill) => app.openNewLoanModal?.(prefill));
    });
  };
  app.openAgentDrawer = (identifier) => {
    void import('@/features/agent/fillAgentDrawers').then(({ fillAndOpenAgentDrawer }) => fillAndOpenAgentDrawer(identifier));
  };
  app.openAnalystDossierDrawer = (identifier) => {
    void import('@/features/agent/fillAgentDrawers').then(({ fillAndOpenAnalystDrawer }) => fillAndOpenAnalystDrawer(identifier));
  };
  app.openAnalyst360FromAgent = () => {
    void import('@/features/agent/fillAgentDrawers').then(({ openAnalyst360FromAgent }) => openAnalyst360FromAgent());
  };
  app.openAnalyst360Modal = () => {
    void import('@/features/agent/fillAgentDrawers').then(({ openAnalyst360Modal }) => openAnalyst360Modal());
  };
  app.openInspectionDrawer = (identifier) => {
    void import('@/features/agent/fillAgentDrawers').then(({ fillAndOpenInspectionDrawer }) => fillAndOpenInspectionDrawer(identifier));
  };
  app.openInspectionFromAgentDrawer = () => {
    void import('@/features/agent/fillAgentDrawers').then(({ openInspectionFromAgentDrawer }) => openInspectionFromAgentDrawer());
  };
  app.openComplementsDrawer = (identifier) => {
    void import('@/features/agent/fillAgentDrawers').then(({ fillAndOpenComplementsDrawer }) => fillAndOpenComplementsDrawer(identifier));
  };
  app.triggerReminderFromDrawer = () => {
    void import('@/features/agent/fillAgentDrawers').then(({ triggerReminderFromDrawer }) => triggerReminderFromDrawer());
  };
  app.markDocReceivedFromDrawer = () => {
    void import('@/features/agent/fillAgentDrawers').then(({ markDocReceivedFromDrawer }) => markDocReceivedFromDrawer());
  };
  app.triggerDrawerFileUpload = () => {
    void import('@/features/agent/fillAgentDrawers').then(({ triggerDrawerFileUpload }) => triggerDrawerFileUpload());
  };
  app.requestComplementsFromAgentDrawer = () => {
    void import('@/features/agent/fillAgentDrawers').then(({ requestComplementsFromAgentDrawer }) => requestComplementsFromAgentDrawer());
  };
  app.requestComplementFromAnalystDrawer = () => {
    void import('@/features/agent/fillAgentDrawers').then(({ requestComplementFromAnalystDrawer }) => requestComplementFromAnalystDrawer());
  };
  app.submitHumanValidationFromDrawer = (...args: unknown[]) => {
    void import('@/features/agent/fillAgentDrawers').then(({ submitHumanValidationFromDrawer }) =>
      submitHumanValidationFromDrawer(
        (args[0] as 'VALIDATED' | 'TO_COMPLETE' | 'REJECTED' | undefined) || 'VALIDATED',
        typeof args[1] === 'number' ? args[1] : undefined,
      ),
    );
  };
  app.requestDocumentReworkFromDrawer = () => {
    void import('@/features/agent/fillAgentDrawers').then(({ requestDocumentReworkFromDrawer }) => requestDocumentReworkFromDrawer());
  };
  app.openDocLightbox = (identifier) => {
    void import('@/features/workflow/fillDocLightbox').then(({ openDocLightbox }) => openDocLightbox(identifier));
  };
  app.closeDocLightbox = () => {
    void import('@/features/workflow/fillDocLightbox').then(({ closeDocLightbox }) => closeDocLightbox());
  };
  app.zoomDocLightbox = (factor) => {
    void import('@/features/workflow/fillDocLightbox').then(({ zoomDocLightbox }) => zoomDocLightbox(typeof factor === 'number' ? factor : 1.15));
  };
  app.resetDocLightboxZoom = () => {
    void import('@/features/workflow/fillDocLightbox').then(({ resetDocLightboxZoom }) => resetDocLightboxZoom());
  };
  app.rotateDocLightbox = () => {
    void import('@/features/workflow/fillDocLightbox').then(({ rotateDocLightbox }) => rotateDocLightbox());
  };
  app.downloadDocLightbox = () => {
    void import('@/features/workflow/fillDocLightbox').then(({ downloadDocLightbox }) => downloadDocLightbox());
  };
  app.openAnomalyDrawer = (identifier) => {
    void import('@/features/agent/fillAgentDrawers').then(({ fillAndOpenAnomalyDrawer }) => fillAndOpenAnomalyDrawer(identifier));
  };
  app.closeAnomalyDrawer = () => showBackdrop('anomaly-drawer-backdrop', false);
  app.resolveAnomalyFromDrawer = () => {
    void import('@/features/agent/fillAgentDrawers').then(({ resolveAnomalyFromDrawer }) => resolveAnomalyFromDrawer());
  };
  app.openCommitteeDrawer = (identifier) => {
    void import('@/features/committee/fillCommittee').then(({ fillAndOpenCommitteeDrawer }) => fillAndOpenCommitteeDrawer(identifier));
  };
  app.closeCommitteeDrawer = () => {
    void import('@/features/committee/fillCommittee').then(({ closeCommitteeDrawer }) => closeCommitteeDrawer());
  };
  app.openCommitteeModal = (identifier) => {
    void import('@/features/committee/fillCommittee').then(({ fillAndOpenCommitteeModal }) => fillAndOpenCommitteeModal(identifier));
  };
  app.openCommitteeVote = (identifier) => app.openCommitteeModal?.(identifier);
  app.closeCommitteeModal = () => {
    void import('@/features/committee/fillCommittee').then(({ closeCommitteeModal }) => closeCommitteeModal());
  };
  app.openCommitteeModalFromDrawer = () => {
    void import('@/features/committee/fillCommittee').then(({ openCommitteeModalFromDrawer }) => openCommitteeModalFromDrawer());
  };
  app.openFirstPendingCommitteeVote = () => {
    void import('@/features/committee/fillCommittee').then(({ openFirstPendingCommitteeVote }) => openFirstPendingCommitteeVote());
  };
  app.submitCommitteeDecision = (decision) => {
    void import('@/features/committee/fillCommittee').then(({ submitCommitteeDecisionFromModal }) =>
      submitCommitteeDecisionFromModal(typeof decision === 'string' ? decision : undefined),
    );
  };
  app.closeModal = (id) => showBackdrop(id, false);
  app.downloadAllSignedPvsCsv = () => undefined;
  app.saveInspectionReport = () => {
    void import('@/features/agent/fillAgentDrawers').then(({ saveInspectionReport }) => saveInspectionReport());
  };
  app.openInspectionModalFromDrawer = () => {
    void import('@/features/agent/fillAgentDrawers').then(({ openInspectionModalFromDrawer }) => openInspectionModalFromDrawer());
  };

  app.openClientRequestDrawer = (identifier) => {
    void import('@/features/client/fillClientRequestDrawer').then(async ({ fillClientRequestDrawer }) => {
      const opened = await fillClientRequestDrawer(identifier);
      if (opened) {
        showBackdrop('client-request-drawer-backdrop', true);
      }
    });
  };

  const originalFilterDocs = app.filterClientDocs?.bind(app);
  app.filterClientDocs = (category: string, buttonEl?: Element | null) => {
    originalFilterDocs?.(category, buttonEl);
    document.querySelectorAll('#client-documents-grid .doc-card-item').forEach((node) => {
      const card = node as HTMLElement;
      const show = card.style.display !== 'none';
      if (card.tagName === 'TR') {
        card.style.display = show ? 'table-row' : 'none';
      } else if (show) {
        card.style.display = '';
      }
    });
    window.dispatchEvent(new CustomEvent('creditfast-docs-filter', { detail: category }));
  };

  const originalUpload = app.handleClientDocUpload?.bind(app);
  app.handleClientDocUpload = (event: Event) => {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      originalUpload?.(event);
      return;
    }
    void import('@/api/credit').then(async ({ listMyCreditRequests, uploadCreditDocument, getClientSubmitBlockers, submitCreditRequest }) => {
      const { uploadKycDocument, isKycIdentityType } = await import('@/api/profile');
      const { notifyRequestsChanged } = await import('@/features/workflow/workflow');
      const { isApiError } = await import('@/api/errors');
      const type = fieldValue('upload-doc-type') || 'PREUVE_REVENU';
      const number = fieldValue('upload-doc-number');
      try {
        if (isKycIdentityType(type)) {
          await uploadKycDocument(file, type, number || undefined);
          toast.success('Pièce d’identité reçue. L’agent confirmera la conformité.');
          notifyRequestsChanged();
          app.closeUploadDocumentModal?.();
          if (input) {
            input.value = '';
          }
          return;
        }
        const rows = await listMyCreditRequests().catch(() => []);
        const target =
          rows.find((row) => ['DRAFT', 'VERIFICATION_REQUIRED'].includes((row.status || '').toUpperCase())) ?? rows[0];
        if (!target) {
          toast.warning('Déposez d’abord une demande, puis joignez la pièce. Pour une pièce d’identité, choisissez CNI ou passeport.');
          return;
        }
        await uploadCreditDocument(target.id, file, type);
        const { blockers } = await getClientSubmitBlockers(target.id);
        if ((target.status || '').toUpperCase() === 'VERIFICATION_REQUIRED' && !blockers.length) {
          await submitCreditRequest(target.id);
          toast.success('Pièce reçue. Le dossier est renvoyé à l’agent.');
        } else if (blockers.length) {
          toast.success(`Pièce jointe au dossier #${target.id}. Il reste : ${blockers.join(' et ')}.`);
        } else {
          toast.success('Pièce jointe. L’agent confirmera la conformité.');
        }
        notifyRequestsChanged();
        app.closeUploadDocumentModal?.();
        if (input) {
          input.value = '';
        }
      } catch (error) {
        toast.danger(isApiError(error) ? error.message : 'Impossible de joindre la pièce.');
      }
    });
  };

  app.handleClientDocDrop = (event: Event) => {
    const drag = event as DragEvent;
    const file = drag.dataTransfer?.files?.[0];
    if (!file) {
      return;
    }
    const input = document.getElementById('client-file-input') as HTMLInputElement | null;
    if (input) {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  app.switchView = (viewId: string) => {
    if (viewId === 'view-client-wizard') {
      app.openNewLoanModal?.();
      return;
    }
    const path = VIEW_PATHS[viewId];
    if (path) {
      navigate(path);
    }
  };

  const leave = () => {
    void import('@/api/auth')
      .then(({ logoutFromApi }) => logoutFromApi())
      .finally(() => navigate('/'));
  };
  app.openLogoutConfirmModal = leave;
  app.logout = leave;
  app.confirmLogout = leave;

  app.submitNewCreditRequest = () => {
    void import('@/features/client/submitLoan').then(async ({ submitCompleteLoanApplication }) => {
      const { notifyRequestsChanged } = await import('@/features/workflow/workflow');
      const { isApiError } = await import('@/api/errors');
      const consent = document.getElementById('modal-wiz-consent') as HTMLInputElement | null;
      if (consent && !consent.checked) {
        toast.warning('Cochez la certification pour envoyer votre demande.');
        return;
      }
      try {
        await submitCompleteLoanApplication();
        app.closeNewLoanModal?.();
        notifyRequestsChanged();
        toast.success('Demande envoyée à l’agent. Vous serez informé s’il manque une pièce.');
      } catch (error) {
        toast.danger(isApiError(error) ? error.message : error instanceof Error ? error.message : 'Impossible d’envoyer la demande.');
      }
    });
  };

  app.saveDraftCreditRequest = () => {
    void import('@/features/client/submitLoan').then(async ({ saveDraftLoanApplication }) => {
      const { notifyRequestsChanged } = await import('@/features/workflow/workflow');
      const { isApiError } = await import('@/api/errors');
      try {
        const saved = await saveDraftLoanApplication();
        notifyRequestsChanged();
        toast.success(`Brouillon enregistré (dossier #${saved.id}). Vous pourrez le reprendre plus tard.`);
      } catch (error) {
        toast.danger(isApiError(error) ? error.message : error instanceof Error ? error.message : 'Impossible d’enregistrer le brouillon.');
      }
    });
  };

  app.resumeDraftCreditRequest = (identifier) => {
    const id = Number(identifier);
    if (!Number.isFinite(id) || id <= 0) {
      toast.warning('Brouillon introuvable.');
      return;
    }
    void import('@/features/client/submitLoan').then(async ({ loadDraftForWizard }) => {
      const { hydrateWizardFromProfile } = await import('@/features/client/persistFiche');
      const { isApiError } = await import('@/api/errors');
      try {
        const draft = await loadDraftForWizard(id);
        const opened = await app.openNewLoanModal?.({
          amount: draft.requested_amount,
          duration: draft.duration_months,
          purpose: draft.purpose,
          income: draft.declared_monthly_income,
          expenses: draft.declared_monthly_expenses,
        });
        if (opened === false) return;
        await hydrateWizardFromProfile(draft);
        toast.info('Brouillon repris. Complétez puis envoyez, ou enregistrez à nouveau.');
      } catch (error) {
        toast.danger(isApiError(error) ? error.message : 'Impossible d’ouvrir ce brouillon.');
      }
    });
  };

  app.deleteDraftCreditRequest = (identifier) => {
    const id = Number(identifier);
    if (!Number.isFinite(id) || id <= 0) {
      return;
    }
    void import('@/api/credit').then(async ({ deleteCreditRequest }) => {
      const { notifyRequestsChanged } = await import('@/features/workflow/workflow');
      const { isApiError } = await import('@/api/errors');
      try {
        await deleteCreditRequest(id);
        app.closeClientRequestDrawer?.();
        notifyRequestsChanged();
        toast.success('Brouillon supprimé.');
      } catch (error) {
        toast.danger(isApiError(error) ? error.message : 'Suppression impossible (seuls les brouillons peuvent être retirés).');
      }
    });
  };

  app.sendSelectedRequestToAnalysis = () => {
    void import('@/features/workflow/workflow').then(async ({ getSelectedCreditRequestId, notifyRequestsChanged }) => {
      const { sendRequestToAnalysis, getAnalysisTransferBlockers } = await import('@/api/credit');
      const { isApiError } = await import('@/api/errors');
      const id = getSelectedCreditRequestId();
      if (!id) {
        toast.warning('Ouvrez d’abord un dossier de la file agent.');
        return;
      }
      try {
        const { blockers } = await getAnalysisTransferBlockers(id);
        if (blockers.length) {
        toast.warning(`Transmission bloquée : ${blockers.join(', ')}.`);
          return;
        }
        await sendRequestToAnalysis(id);
        app.closeAgentDrawer?.();
        notifyRequestsChanged();
        toast.success('Dossier transmis à l’analyste.');
      } catch (error) {
        toast.danger(isApiError(error) ? error.message : 'Transmission à l’analyste impossible.');
      }
    });
  };

  app.submitAnalystReviewFromDrawer = () => {
    void import('@/features/workflow/workflow').then(async ({ getSelectedCreditRequestId, notifyRequestsChanged }) => {
      const { submitAnalystReview } = await import('@/api/credit');
      const { isApiError } = await import('@/api/errors');
      const id = getSelectedCreditRequestId();
      if (!id) {
        toast.warning('Ouvrez d’abord un dossier analyste.');
        return;
      }
      const rawReco = fieldValue('analyst-drawer-reco-select') || 'FAVORABLE';
      const recommendation =
        rawReco === 'DEFAVORABLE' || rawReco === 'UNFAVORABLE'
          ? 'UNFAVORABLE'
          : rawReco === 'RESERVE' || rawReco === 'RESERVED'
            ? 'RESERVED'
            : 'FAVORABLE';
      const comment =
        fieldValue('analyst-drawer-notes-input') || 'Revue favorable. Dossier cohérent.';
      try {
        if (recommendation === 'FAVORABLE') {
          const { getDocumentComplianceBlockers } = await import('@/api/credit');
          const { blockers } = await getDocumentComplianceBlockers(id);
          if (blockers.length) {
            toast.warning(`Passage au comité bloqué : ${blockers.join(', ')}. Marquez les pièces conformes ou demandez une reprise.`);
            return;
          }
        }
        await submitAnalystReview(id, {
          recommendation,
          comment,
          next_step: recommendation === 'FAVORABLE' ? 'COMMITTEE' : 'VERIFICATION_REQUIRED',
        });
        app.closeAnalystDossierDrawer?.();
        notifyRequestsChanged();
        toast.success(recommendation === 'FAVORABLE' ? 'Dossier transmis au comité.' : 'Compléments demandés au client.');
      } catch (error) {
        toast.danger(isApiError(error) ? error.message : 'Revue analyste impossible.');
      }
    });
  };

  app.showToast = (message: string, type = 'info') => {
    const container = document.getElementById('toast-container');
    if (container && originalToast) {
      originalToast(message, type);
      return;
    }

    if (type === 'success') {
      toast.success(message);
    } else if (type === 'danger') {
      toast.danger(message);
    } else if (type === 'warning') {
      toast.warning(message);
    } else {
      toast.info(message);
    }
  };

  window.App = app;

  const interactions = ((window as unknown as { AppInteractions?: Record<string, (...args: unknown[]) => unknown> }).AppInteractions ??=
    {});
  interactions.closeModal = (id) => {
    if (typeof id === 'string') {
      showBackdrop(id, false);
    }
  };
  interactions.submitCommitteeDecision = (decision) => {
    app.submitCommitteeDecision?.(typeof decision === 'string' ? decision : undefined);
  };
}

export function hydrateLegacyPage(viewId?: string): void {
  const app = window.App;
  if (!app) {
    return;
  }

  const session = getUiSession();
  if (session) {
    const profile = ROLE_PROFILES[session.role];
    app.currentRole = session.role;
    app.currentView = viewId;
    app.currentUser = {
      role: session.role,
      email: session.identifier,
      name: session.name ?? profile.displayName,
    };
  }

  window.AppCharts?.setupDefaults?.();

  if (!viewId) {
    return;
  }

  const runners: Record<string, () => void> = {
    'view-role-client': () => {
      app.renderBorrowerDashboard?.();
      app.updateCompactEstimator?.();
    },
    'view-client-requests': () => app.renderBorrowerDashboard?.(),
    'view-client-documents': () => app.checkAndHighlightExpiringDocs?.(),
    'view-client-simulator': () => {
      void import('@/features/client/runSimulation').then(({ hydrateSimulatorFromProfile }) => hydrateSimulatorFromProfile());
    },
    'view-client-schedule': () => app.renderClientSchedule?.(),
    'view-role-agent': () => app.renderAgentDashboard?.(),
    'view-agent-inspections': () => app.renderAgentInspections?.(),
    'view-agent-clients': () => app.renderAgentClientsPortfolio?.(),
    'view-agent-complements': () => app.renderAgentComplements?.(),
    'view-agent-loans': () => undefined,
    'view-role-analyst': () => app.renderAnalystDashboard?.(),
    'view-analyst-dossiers': () => app.renderAnalystDashboard?.(),
    'view-analyst-anomalies': () => app.renderAnalystAnomalies?.(),
    'view-role-committee': () => undefined,
    'view-committee-dossiers': () => undefined,
    'view-committee-signed': () => undefined,
    'view-scoring-admin': () => app.updateColdStartComparisonSim?.(),
    'view-audit-logs': () => app.renderAuditLogs?.(),
  };

  runners[viewId]?.();
}
