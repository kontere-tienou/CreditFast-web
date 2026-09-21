import { toast } from '@heroui/react';
import {
  fetchCreditDocumentFile,
  fetchGuaranteeFile,
  getCreditDocument,
  getCreditGuarantee,
  guaranteeHasFile,
  guaranteeStatusLabel,
  guaranteeTypeLabel,
  type CreditDocument,
  type CreditGuarantee,
} from '@/api/credit';
import { fetchKycDocumentFile, getKycDocument, listKycDocuments, type KycDocument } from '@/api/profile';
import { isApiError } from '@/api/errors';
import { getUiSession } from '@/app/session';
import { documentCheck, extractedFieldsFromDocument, identityCheck } from '@/features/workflow/compliance';
import { formatDate, formatFcfa } from '@/features/workflow/workflow';

export type LightboxTarget = {
  kind: 'CREDIT' | 'KYC' | 'GUARANTEE';
  documentId: number;
  requestId?: number;
  clientId?: number;
};

let objectUrl: string | null = null;
let zoom = 1;
let rotation = 0;
let currentName = 'Pièce';

function showModal(visible: boolean) {
  const modal = document.getElementById('modal-doc-lightbox');
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

function applyTransform() {
  const sheet = document.getElementById('doc-lightbox-sheet');
  const zoomVal = document.getElementById('doc-lightbox-zoom-val');
  if (sheet) {
    sheet.style.transform = `scale(${zoom}) rotate(${rotation}deg)`;
  }
  if (zoomVal) {
    zoomVal.textContent = `${Math.round(zoom * 100)}%`;
  }
}

function revokeUrl() {
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }
}

export function parseLightboxTarget(raw: unknown): LightboxTarget | null {
  if (raw && typeof raw === 'object' && 'documentId' in (raw as LightboxTarget)) {
    const target = raw as LightboxTarget;
    if (Number.isFinite(target.documentId) && target.documentId > 0) {
      return target;
    }
  }
  const text = String(raw ?? '').trim();
  const guarantee = text.match(/^GUARANTEE-(\d+)(?:-(\d+))?$/i);
  if (guarantee) {
    if (guarantee[2]) {
      return { kind: 'GUARANTEE', requestId: Number(guarantee[1]), documentId: Number(guarantee[2]) };
    }
    return { kind: 'GUARANTEE', documentId: Number(guarantee[1]) };
  }
  const credit = text.match(/^CREDIT-(\d+)-(\d+)$/i);
  if (credit) {
    return { kind: 'CREDIT', requestId: Number(credit[1]), documentId: Number(credit[2]) };
  }
  const kyc = text.match(/^KYC-(\d+)(?:-(\d+))?$/i);
  if (kyc) {
    if (kyc[2]) {
      return { kind: 'KYC', clientId: Number(kyc[1]), documentId: Number(kyc[2]) };
    }
    return { kind: 'KYC', documentId: Number(kyc[1]) };
  }
  const numeric = Number(text);
  if (Number.isFinite(numeric) && numeric > 0) {
    return { kind: 'CREDIT', documentId: numeric };
  }
  return null;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function setText(id: string, value: string) {
  const node = document.getElementById(id);
  if (node) {
    node.textContent = value;
  }
}

function renderPreview(contentType: string, url: string, filename: string) {
  const canvas = document.getElementById('doc-lightbox-rendered-content');
  const sheet = document.getElementById('doc-lightbox-sheet');
  if (!canvas) {
    return;
  }
  if (sheet) {
    sheet.style.padding = contentType.startsWith('image/') || contentType.includes('pdf') ? '0' : '2rem';
    sheet.style.minHeight = 'auto';
    sheet.style.width = 'min(620px, 100%)';
    sheet.style.background = 'var(--bg-surface)';
  }
  if (contentType.startsWith('image/')) {
    canvas.innerHTML = `<img src="${url}" alt="${escapeHtml(filename)}" style="display:block;width:100%;height:auto;" />`;
    return;
  }
  if (contentType.includes('pdf')) {
    canvas.innerHTML = `<iframe title="${escapeHtml(filename)}" src="${url}" style="width:100%;min-height:720px;border:0;background:#fff"></iframe>`;
    return;
  }
  canvas.innerHTML = `<p style="margin:1.5rem;font-size:0.85rem;color:var(--text-muted)">Aperçu non disponible pour ce format. Utilisez Télécharger.</p>`;
}

function renderFields(doc: CreditDocument | KycDocument | CreditGuarantee, kind: LightboxTarget['kind']) {
  const list = document.getElementById('doc-lightbox-fields-list');
  if (!list) {
    return;
  }
  if (kind === 'GUARANTEE') {
    const guarantee = doc as CreditGuarantee;
    const rows = [
      { label: 'Nature', value: guaranteeTypeLabel(guarantee.guarantee_type) },
      { label: 'Valeur déclarée', value: formatFcfa(guarantee.declared_value) },
      { label: 'Valeur retenue', value: guarantee.verified_value != null ? formatFcfa(guarantee.verified_value) : '—' },
      { label: 'Contrôle', value: guaranteeStatusLabel(guarantee.verification_status) },
      { label: 'Description', value: guarantee.description || '—' },
      { label: 'Fichier', value: guarantee.original_filename || '—' },
    ];
    list.innerHTML = rows
      .map(
        (field) => `<div class="doc-ocr-field-item">
            <div class="doc-ocr-field-lbl">${escapeHtml(field.label)}</div>
            <div class="doc-ocr-field-val">${escapeHtml(field.value)}</div>
          </div>`,
      )
      .join('');
    return;
  }
  const fields = extractedFieldsFromDocument(doc as CreditDocument | KycDocument);
  list.innerHTML = fields.length
    ? fields
        .map(
          (field) => `<div class="doc-ocr-field-item">
            <div class="doc-ocr-field-lbl">${escapeHtml(field.label)}</div>
            <div class="doc-ocr-field-val">${escapeHtml(field.value)}</div>
          </div>`,
        )
        .join('')
    : `<p style="margin:0;font-size:0.76rem;color:var(--text-muted)">Aucune information extraite pour l’instant. Le fichier reste consultable.</p>`;
}

function renderChecks(status?: string, kind: LightboxTarget['kind'] = 'CREDIT') {
  const box = document.getElementById('doc-lightbox-checks');
  if (!box) {
    return;
  }
  if (kind === 'GUARANTEE') {
    const key = (status || 'PENDING').toUpperCase();
    const lines =
      key === 'VERIFIED'
        ? ['Garantie acceptée après contrôle']
        : key === 'REJECTED'
          ? ['Garantie refusée']
          : ['En attente de contrôle terrain'];
    box.innerHTML = lines
      .map((line) => `<div style="display:flex;align-items:center;gap:0.35rem"><i class="fas fa-${key === 'REJECTED' ? 'xmark' : 'check'} text-emerald"></i> ${escapeHtml(line)}</div>`)
      .join('');
    return;
  }
  const check = kind === 'KYC' ? identityCheck(status) : documentCheck(status);
  const lines =
    check.tone === 'good'
      ? ['Contrôle humain : conforme']
      : check.tone === 'bad'
        ? ['Contrôle : non conforme']
        : check.tone === 'warn'
          ? ['Pièce à reprendre']
          : check.tone === 'ok'
            ? ['Lecture faite', 'Contrôle humain en attente']
            : ['Lecture automatique en cours'];
  box.innerHTML = lines
    .map((line) => `<div style="display:flex;align-items:center;gap:0.35rem"><i class="fas fa-${check.tone === 'bad' ? 'xmark' : 'check'} text-emerald"></i> ${escapeHtml(line)}</div>`)
    .join('');
}

function renderActions(target: LightboxTarget, kind: LightboxTarget['kind']) {
  const box = document.getElementById('doc-lightbox-actions');
  if (!box) {
    return;
  }
  const role = getUiSession()?.role;
  const staff = role === 'ANALYST' || role === 'ADMIN' || role === 'CREDIT_OFFICER' || role === 'COMMITTEE';
  if (!staff || kind === 'GUARANTEE') {
    box.innerHTML = '';
    return;
  }
  if (kind === 'CREDIT' && (role === 'ANALYST' || role === 'ADMIN')) {
    box.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:0.4rem">
      <button type="button" class="btn btn-primary btn-sm" data-lb-decision="VALIDATED">Conforme</button>
      <button type="button" class="btn btn-secondary btn-sm" data-lb-decision="TO_COMPLETE">À reprendre</button>
      <button type="button" class="btn btn-secondary btn-sm" data-lb-decision="REJECTED">Non conforme</button>
    </div>`;
    box.onclick = (event) => {
      const btn = (event.target as HTMLElement).closest<HTMLElement>('[data-lb-decision]');
      if (!btn) {
        return;
      }
      const decision = btn.dataset.lbDecision as 'VALIDATED' | 'TO_COMPLETE' | 'REJECTED';
      void import('@/features/agent/fillAgentDrawers').then(({ submitHumanValidationFromDrawer }) =>
        submitHumanValidationFromDrawer(decision, target.documentId),
      );
    };
    return;
  }
  if (kind === 'KYC' && target.clientId && (role === 'CREDIT_OFFICER' || role === 'ADMIN')) {
    box.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:0.4rem">
      <button type="button" class="btn btn-primary btn-sm" data-lb-kyc="VERIFIED">Identité conforme</button>
      <button type="button" class="btn btn-secondary btn-sm" data-lb-kyc="REJECTED">Non conforme</button>
    </div>`;
    box.onclick = (event) => {
      const btn = (event.target as HTMLElement).closest<HTMLElement>('[data-lb-kyc]');
      if (!btn || !target.clientId) {
        return;
      }
      void import('@/features/agent/fillAgentDrawers').then(({ verifyIdentityFromDrawer }) =>
        verifyIdentityFromDrawer(target.clientId as number, target.documentId, btn.dataset.lbKyc as 'VERIFIED' | 'REJECTED'),
      );
    };
    return;
  }
  box.innerHTML = '';
}

function guaranteeBadge(status?: string) {
  const key = (status || 'PENDING').toUpperCase();
  if (key === 'VERIFIED') {
    return { label: 'Acceptée', badgeClass: 'badge badge-approved' };
  }
  if (key === 'REJECTED') {
    return { label: 'Refusée', badgeClass: 'badge badge-rejected' };
  }
  return { label: 'En attente', badgeClass: 'badge badge-verification' };
}

export async function openDocLightbox(raw?: unknown) {
  const { getSelectedCreditRequestId } = await import('@/features/workflow/workflow');
  const target = parseLightboxTarget(raw);
  if (!target) {
    toast.info('Ouvrez une pièce du dossier, pas un exemple.');
    return;
  }
  if ((target.kind === 'CREDIT' || target.kind === 'GUARANTEE') && !target.requestId) {
    const selected = getSelectedCreditRequestId();
    if (selected) {
      target.requestId = selected;
    }
  }
  currentName = 'Pièce';
  zoom = 1;
  rotation = 0;
  applyTransform();
  revokeUrl();
  setText('doc-lightbox-title', 'Chargement…');
  setText('doc-lightbox-meta', '—');
  showModal(true);

  try {
    let title = 'Pièce';
    let meta = '';
    let mime = '';
    let status: string | undefined;
    let fieldsSource: CreditDocument | KycDocument | CreditGuarantee = { id: target.documentId };
    let badgeLabel = '';
    let badgeClass = '';

    if (target.kind === 'GUARANTEE') {
      let guarantee: CreditGuarantee | null = null;
      if (target.requestId) {
        guarantee = await getCreditGuarantee(target.requestId, target.documentId).catch(() => null);
      }
      if (!guarantee) {
        guarantee = { id: target.documentId };
      }
      if (!guaranteeHasFile(guarantee) && guarantee.has_file !== undefined) {
        toast.info('Aucun fichier joint à cette garantie.');
        showModal(false);
        return;
      }
      fieldsSource = guarantee;
      title = guarantee.original_filename || guaranteeTypeLabel(guarantee.guarantee_type) || 'Fichier de garantie';
      status = guarantee.verification_status;
      mime = guarantee.mime_type || '';
      meta = [guaranteeTypeLabel(guarantee.guarantee_type), mime || 'Fichier'].filter(Boolean).join(' • ');
      const file = await fetchGuaranteeFile(target.documentId);
      mime = file.contentType || mime;
      currentName = file.filename || title;
      objectUrl = URL.createObjectURL(file.blob);
      renderPreview(mime, objectUrl, currentName);
      const badge = guaranteeBadge(status);
      badgeLabel = badge.label;
      badgeClass = badge.badgeClass;
    } else if (target.kind === 'CREDIT' && target.requestId) {
      const doc = (await getCreditDocument(target.requestId, target.documentId)) ?? { id: target.documentId };
      fieldsSource = doc;
      title = doc.original_filename || doc.document_type || 'Pièce de crédit';
      mime = doc.mime_type || '';
      status = doc.status;
      meta = [mime || 'Fichier', doc.uploaded_at ? formatDate(doc.uploaded_at) : ''].filter(Boolean).join(' • ');
      const file = await fetchCreditDocumentFile(target.documentId);
      mime = file.contentType || mime;
      currentName = file.filename || title;
      objectUrl = URL.createObjectURL(file.blob);
      renderPreview(mime, objectUrl, currentName);
      const check = documentCheck(status);
      badgeLabel = check.label;
      badgeClass = check.badgeClass;
    } else if (target.kind === 'KYC') {
      let doc: KycDocument = { id: target.documentId };
      if (target.clientId) {
        const { listAgentClientKycDocuments } = await import('@/api/agent');
        const listed = await listAgentClientKycDocuments(target.clientId).catch(() => [] as KycDocument[]);
        doc = listed.find((item) => item.id === target.documentId) ?? doc;
      } else {
        const detailed = await getKycDocument(target.documentId).catch(() => null);
        if (detailed) {
          doc = detailed;
        } else {
          const listed = await listKycDocuments().catch(() => [] as KycDocument[]);
          doc = listed.find((item) => item.id === target.documentId) ?? doc;
        }
      }
      fieldsSource = doc;
      title = doc.original_filename || doc.document_type || 'Pièce d’identité';
      status = doc.status;
      meta = [doc.uploaded_at ? formatDate(doc.uploaded_at) : ''].filter(Boolean).join(' • ');
      const file = await fetchKycDocumentFile(target.documentId);
      mime = file.contentType;
      currentName = file.filename || title;
      objectUrl = URL.createObjectURL(file.blob);
      renderPreview(mime, objectUrl, currentName);
      const check = identityCheck(status);
      badgeLabel = check.label;
      badgeClass = check.badgeClass;
    } else {
      toast.warning('Dossier introuvable pour cette pièce.');
      showModal(false);
      return;
    }

    setText('doc-lightbox-title', title);
    setText('doc-lightbox-meta', meta || '—');
    const badge = document.getElementById('doc-lightbox-badge');
    if (badge) {
      badge.className = badgeClass;
      badge.style.fontSize = '0.68rem';
      badge.innerHTML = badgeLabel;
    }
    const icon = document.getElementById('doc-lightbox-file-icon');
    if (icon) {
      icon.className = mime.includes('pdf') ? 'fas fa-file-pdf' : mime.startsWith('image/') ? 'fas fa-file-image' : 'fas fa-file';
    }
    const conf = document.getElementById('doc-lightbox-conf-score');
    if (conf) {
      conf.textContent = badgeLabel;
    }
    renderFields(fieldsSource, target.kind);
    renderChecks(status, target.kind);
    renderActions(target, target.kind);
  } catch (error) {
    toast.danger(isApiError(error) ? error.message : 'Impossible d’ouvrir cette pièce.');
    showModal(false);
  }
}

export function closeDocLightbox() {
  showModal(false);
  revokeUrl();
}

export function zoomDocLightbox(factor: number) {
  zoom = factor > 1 ? Math.min(2.2, zoom * factor) : Math.max(0.6, zoom * factor);
  applyTransform();
}

export function resetDocLightboxZoom() {
  zoom = 1;
  rotation = 0;
  applyTransform();
}

export function rotateDocLightbox() {
  rotation = (rotation + 90) % 360;
  applyTransform();
}

export function downloadDocLightbox() {
  if (!objectUrl) {
    toast.info('Aucun fichier à télécharger.');
    return;
  }
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = currentName;
  link.click();
}
