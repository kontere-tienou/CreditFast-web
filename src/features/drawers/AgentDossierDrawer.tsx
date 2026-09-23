import { useState } from 'react';
import { callApp } from '@/shared/ui/legacy';
import { ComplementRequestDialog } from '@/features/workflow/ComplementRequestDialog';
import { submitStructuredComplement } from '@/features/agent/fillAgentDrawers';

export function AgentDossierDrawer() {
  const [complementOpen, setComplementOpen] = useState(false);
  const [complementBusy, setComplementBusy] = useState(false);
  return (
    <>
<div id="agent-drawer-backdrop" className="schedule-drawer-backdrop" onClick={() => callApp("closeAgentDrawer")}>
  <div className="schedule-drawer" onClick={(event) => event.stopPropagation()}>
    {/* Drawer Header */}
    <div className="schedule-drawer-header">
      <div className="schedule-drawer-title-box">
        <div className="schedule-drawer-icon">
          <i className="fas fa-folder-open"></i>
        </div>
        <div>
          <h3 id="agent-drawer-title" style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Dossier</h3>
          <p id="agent-drawer-date" style={{ fontSize: "0.74rem", color: "var(--text-muted)", margin: 0, marginTop: "2px" }}>—</p>
        </div>
      </div>
      <button type="button" className="modal-close-btn" onClick={() => callApp("closeAgentDrawer")} title="Fermer le volet">
        <i className="fas fa-times"></i>
      </button>
    </div>

    {/* Drawer Body */}
    <div className="schedule-drawer-body">
      {/* 1. Hero Amount & Status Summary Banner */}
      <div className="drawer-hero-banner">
        <div className="drawer-hero-label">Montant Net Demandé</div>
        <div id="agent-drawer-hero-amount" className="drawer-hero-val">—</div>
        <div style={{ marginTop: "10px", display: "flex", gap: "0.5rem", justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
          <span id="agent-drawer-hero-status-container">
            <span id="agent-drawer-hero-status" className="badge badge-submitted">—</span>
          </span>
          <span id="agent-drawer-hero-mode" className="badge badge-submitted" style={{ fontSize: "0.7rem" }}>File agent</span>
        </div>
      </div>

      <div className="drawer-panel">
        <div className="drawer-panel-header">
          <h4 className="drawer-panel-title">
            <i className="fas fa-timeline text-primary"></i> Parcours du dossier
          </h4>
          <span id="agent-drawer-timeline-badge" className="badge badge-submitted" style={{ fontSize: "0.68rem" }}>Suivi</span>
        </div>
        <div id="agent-drawer-workflow-timeline" className="drawer-timeline">
          {/* Dynamic timeline */}
        </div>
      </div>

      <div className="drawer-panel">
        <div className="drawer-panel-header">
          <h4 className="drawer-panel-title">
            <i className="fas fa-clock-rotate-left text-primary"></i> Journal d'audit du dossier
          </h4>
          <span id="agent-drawer-audit-badge" className="badge badge-submitted" style={{ fontSize: "0.68rem" }}>Traçabilité</span>
        </div>
        <div id="agent-drawer-audit-trail" className="audit-trail">
          {/* Dynamic audit trail */}
        </div>
      </div>

      {/* 2. Borrower & Contact Panel */}
      <div className="drawer-panel">
        <div className="drawer-panel-header">
          <h4 className="drawer-panel-title">
            <i className="fas fa-user-circle text-primary"></i> Profil Emprunteur & Contact
          </h4>
          <span id="agent-drawer-client-number" className="badge badge-submitted" style={{ fontFamily: "var(--font-family-code)", fontSize: "0.68rem" }}>—</span>
        </div>

        <div style={{ display: "flex", gap: "0.85rem", alignItems: "center", marginBottom: "0.85rem", paddingBottom: "0.85rem", borderBottom: "1px dashed var(--border-color)" }}>
          <img id="agent-drawer-client-avatar" src="https://ui-avatars.com/api/?name=Client&background=1b4332&color=fff" alt="" className="user-avatar" style={{ width: "46px", height: "46px", borderRadius: "var(--radius-md)", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div id="agent-drawer-client-name" style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-primary)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>Demandeur</div>
            <div id="agent-drawer-client-occupation" style={{ fontSize: "0.76rem", color: "var(--text-muted)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>—</div>
          </div>
        </div>

        <div className="drawer-grid-2">
          <div className="drawer-kv">
            <span className="drawer-kv-label"><i className="fas fa-location-dot text-primary mr-1"></i> Localisation</span>
            <span id="agent-drawer-client-location" className="drawer-kv-value">—</span>
          </div>
          <div className="drawer-kv">
            <span className="drawer-kv-label"><i className="fas fa-phone text-emerald mr-1"></i> Téléphone</span>
            <span id="agent-drawer-client-phone" className="drawer-kv-value" style={{ fontFamily: "var(--font-family-code)" }}>—</span>
          </div>
          <div className="drawer-kv">
            <span className="drawer-kv-label"><i className="fas fa-envelope text-info mr-1"></i> Email</span>
            <span id="agent-drawer-client-email" className="drawer-kv-value" style={{ fontSize: "0.76rem" }}>—</span>
          </div>
          <div className="drawer-kv">
            <span className="drawer-kv-label"><i className="fas fa-id-card text-gold mr-1"></i> Conformité identité</span>
            <span id="agent-drawer-client-kyc" className="badge badge-submitted" style={{ fontSize: "0.68rem", alignSelf: "flex-start" }}>—</span>
          </div>
        </div>

        {/* Quick Contact Action Buttons */}
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.85rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border-color-light, #f1f5f9)" }}>
          <button type="button" className="btn btn-secondary btn-sm" id="agent-drawer-btn-sms" style={{ flex: 1, justifyContent: "center", fontSize: "0.76rem" }}>
            <i className="fas fa-comment-sms text-primary"></i> Relance SMS
          </button>
          <button type="button" className="btn btn-secondary btn-sm" id="agent-drawer-btn-call" style={{ flex: 1, justifyContent: "center", fontSize: "0.76rem" }}>
            <i className="fas fa-phone text-emerald"></i> Appeler
          </button>
        </div>
      </div>

      {/* 3. Financial Capacity & Repayment Schedule Panel */}
      <div className="drawer-panel">
        <div className="drawer-panel-header">
          <h4 className="drawer-panel-title">
            <i className="fas fa-coins text-gold"></i> Paramètres Prêt & Capacité
          </h4>
          <span id="agent-drawer-capacity-badge">
            <span className="badge badge-submitted">—</span>
          </span>
        </div>

        <div className="drawer-grid-2" style={{ marginBottom: "0.75rem" }}>
          <div className="drawer-metric-box">
            <div className="drawer-kv-label">Durée Accordée</div>
            <div id="agent-drawer-duration" style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--text-primary)", fontFamily: "var(--font-family-code)" }}>—</div>
          </div>
          <div className="drawer-metric-box">
            <div className="drawer-kv-label">Mensualité Estimée</div>
            <div id="agent-drawer-monthly-payment" style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--primary-700)", fontFamily: "var(--font-family-code)" }}>—</div>
          </div>
          <div className="drawer-metric-box">
            <div className="drawer-kv-label">Revenus Mensuels</div>
            <div id="agent-drawer-income" style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-family-code)" }}>—</div>
          </div>
          <div className="drawer-metric-box">
            <div className="drawer-kv-label">Reste à Vivre Net</div>
            <div id="agent-drawer-disposable" style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--cif-emerald-700)", fontFamily: "var(--font-family-code)" }}>—</div>
          </div>
        </div>

        <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "0.35rem", borderTop: "1px dashed var(--border-color)" }}>
          <span>Charges mensuelles déclarées :</span>
          <strong id="agent-drawer-expenses" style={{ color: "var(--text-primary)", fontFamily: "var(--font-family-code)" }}>—</strong>
        </div>
      </div>

      {/* 4. Financing Purpose & Collaterals Panel */}
      <div className="drawer-panel">
        <div className="drawer-panel-header">
          <h4 className="drawer-panel-title">
            <i className="fas fa-shield-halved text-emerald"></i> Objet du Prêt & Garanties
          </h4>
          <span id="agent-drawer-guarantee-status" className="badge badge-submitted" style={{ fontSize: "0.68rem" }}>—</span>
        </div>

        <div style={{ background: "var(--bg-surface-secondary)", padding: "0.75rem 0.85rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)", marginBottom: "0.75rem" }}>
          <div style={{ fontSize: "0.7rem", textTransform: "uppercase", fontWeight: 700, color: "var(--text-muted)", marginBottom: "2px" }}>Objet déclaré</div>
          <p id="agent-drawer-purpose" style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)", margin: 0, lineHeight: 1.45 }}>—</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", fontSize: "0.78rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--text-muted)" }}>Type de garantie :</span>
            <strong id="agent-drawer-guarantee-type" style={{ color: "var(--text-primary)" }}>—</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--text-muted)" }}>Description :</span>
            <span id="agent-drawer-guarantee-desc" style={{ fontWeight: 500, textAlign: "right", maxWidth: "60%", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>—</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "0.35rem", borderTop: "1px dashed var(--border-color)" }}>
            <span>Valeur déclarée : <strong id="agent-drawer-guarantee-declared" style={{ color: "var(--text-primary)", fontFamily: "var(--font-family-code)" }}>—</strong></span>
            <span>Expertise terrain : <strong id="agent-drawer-guarantee-verified" style={{ color: "var(--cif-emerald-700)", fontFamily: "var(--font-family-code)" }}>—</strong></span>
          </div>
          <button type="button" className="btn btn-secondary btn-xs" id="agent-drawer-btn-guarantee-file" style={{ display: "none", alignSelf: "flex-start", marginTop: "0.25rem" }}>
            <i className="fas fa-eye"></i> Voir le fichier de garantie
          </button>
        </div>
      </div>

      {/* 5. Conformité des pièces */}
      <div className="drawer-panel">
        <div className="drawer-panel-header">
          <h4 className="drawer-panel-title">
            <i className="fas fa-file-contract text-primary"></i> Conformité des pièces
          </h4>
          <span id="agent-drawer-docs-count" className="badge badge-submitted" style={{ fontSize: "0.68rem" }}>0 document</span>
        </div>

        <div id="agent-drawer-docs-list" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {/* Dynamically populated */}
        </div>
      </div>

    </div>

    {/* Drawer Footer Actions */}
    <div className="schedule-drawer-footer" style={{ justifyContent: "center", flexDirection: "column", alignItems: "stretch" }}>
      <p id="agent-drawer-lock" hidden style={{ margin: "0 0 0.55rem", fontSize: "0.78rem", color: "var(--text-muted)" }} />
      <div
        id="agent-drawer-footer-actions"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0.55rem",
          width: "100%",
          justifyItems: "stretch",
          alignItems: "center",
        }}
      >
        <button type="button" className="btn btn-secondary btn-sm agent-drawer-footer-btn" id="agent-drawer-btn-complements" onClick={() => setComplementOpen(true)}>
          <i className="fas fa-triangle-exclamation mr-1"></i> Demander des compléments
        </button>
        <button type="button" className="btn btn-secondary btn-sm agent-drawer-footer-btn" id="agent-drawer-btn-inspection" onClick={() => callApp("openInspectionFromAgentDrawer")}>
          <i className="fas fa-motorcycle mr-1"></i> Contrôle terrain
        </button>
        <button type="button" className="btn btn-primary btn-sm agent-drawer-footer-btn" id="agent-drawer-btn-transfer" onClick={() => callApp("sendSelectedRequestToAnalysis")} style={{ gridColumn: "1 / -1" }}>
          <i className="fas fa-paper-plane mr-1"></i> Transmettre à l'analyste
        </button>
      </div>
    </div>
  </div>
</div>
    <ComplementRequestDialog
      open={complementOpen}
      busy={complementBusy}
      onClose={() => setComplementOpen(false)}
      onConfirm={(input) => {
        setComplementBusy(true);
        void submitStructuredComplement({ ...input, channel: 'agent' }).then((ok) => {
          setComplementBusy(false);
          if (ok) setComplementOpen(false);
        });
      }}
    />
    </>
  );
}
