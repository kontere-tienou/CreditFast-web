import { CfSelect } from '@/shared/ui/CfSelect';
import { callApp } from '@/shared/ui/legacy';

export function AnalystDossierDrawer() {
  return (
    <>
<div id="analyst-drawer-backdrop" className="schedule-drawer-backdrop" onClick={() => callApp("closeAnalystDossierDrawer")}>
    <div id="analyst-sidedrawer" className="schedule-drawer" onClick={(event) => event.stopPropagation()} aria-label="Volet instruction approfondie analyste risque">
      <div className="schedule-drawer-header">
        <div className="schedule-drawer-header-content">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem", flexWrap: "wrap" }}>
            <span className="badge badge-submitted" id="analyst-drawer-ref-badge" style={{ fontFamily: "var(--font-family-code)", fontWeight: 700 }}>—</span>
            <span id="analyst-drawer-model-badge" className="badge badge-submitted" style={{ fontSize: "0.68rem" }}>Analyse</span>
            <span id="analyst-drawer-status-badge" className="badge badge-submitted">—</span>
          </div>
          <h3 id="analyst-drawer-title" className="schedule-drawer-title" style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>Dossier</h3>
          <p id="analyst-drawer-subtitle" className="schedule-drawer-subtitle" style={{ fontSize: "0.76rem", color: "var(--text-muted)", margin: 0, marginTop: "2px" }}>Fiche d'instruction • solvabilité, pièces et avis</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button type="button" className="modal-close-btn" onClick={() => callApp("closeAnalystDossierDrawer")} title="Fermer le volet">
            <i className="fas fa-times"></i>
          </button>
        </div>
      </div>

      <div className="schedule-drawer-body">
        <div className="drawer-hero-banner" style={{ background: "linear-gradient(135deg, rgba(27, 67, 50, 0.06), rgba(81, 142, 69, 0.04))", borderColor: "rgba(27, 67, 50, 0.2)", padding: "1rem 1.15rem" }}>
          <div className="drawer-hero-label">Analyse 360°</div>
          <div className="decision-next-action" style={{ marginTop: "0.85rem", textAlign: "left" }}>
            <span className="decision-next-action-label">Prochaine action</span>
            <strong id="analyst-drawer-next-action">—</strong>
          </div>
          <p id="analyst-drawer-decision-summary" className="decision-summary" style={{ textAlign: "left", marginBottom: 0 }}>
            Le dossier reste en analyse tant qu’il n’est pas transmis au comité.
          </p>
        </div>

        <div className="drawer-panel">
          <div className="drawer-panel-header">
            <h4 className="drawer-panel-title"><i className="fas fa-timeline text-primary mr-1"></i> Parcours du dossier</h4>
            <span id="analyst-drawer-timeline-badge" className="badge badge-submitted" style={{ fontSize: "0.68rem" }}>Instruction</span>
          </div>
          <div id="analyst-drawer-workflow-timeline" className="drawer-timeline">
            {/* Dynamic timeline */}
          </div>
        </div>

        <div className="drawer-panel">
          <div className="drawer-panel-header">
            <h4 className="drawer-panel-title"><i className="fas fa-clock-rotate-left text-primary mr-1"></i> Journal d'audit du dossier</h4>
            <span id="analyst-drawer-audit-badge" className="badge badge-submitted" style={{ fontSize: "0.68rem" }}>Traçabilité</span>
          </div>
          <div id="analyst-drawer-audit-trail" className="audit-trail">
            {/* Dynamic audit trail */}
          </div>
        </div>

        <div className="drawer-panel">
          <div className="drawer-panel-header">
            <h4 className="drawer-panel-title"><i className="fas fa-list-check text-emerald mr-1"></i> Checklist de décision</h4>
            <span id="analyst-drawer-readiness-badge" className="badge badge-submitted" style={{ fontSize: "0.68rem" }}>En revue</span>
          </div>
          <div id="analyst-drawer-decision-checklist" className="decision-checklist">
            {/* Dynamic checklist */}
          </div>
        </div>

        {/* Section 1 : Emprunteur & Capacité Financière Nette */}
        <div className="drawer-panel">
          <div className="drawer-panel-header">
            <h4 className="drawer-panel-title"><i className="fas fa-user-circle text-primary mr-1"></i> Emprunteur & Reste à Vivre</h4>
            <span id="analyst-drawer-client-id" className="badge badge-submitted" style={{ fontSize: "0.68rem" }}>—</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.85rem" }}>
            <img id="analyst-drawer-client-avatar" src="https://ui-avatars.com/api/?name=Client&background=4f46e5&color=fff" alt="" className="user-avatar" style={{ width: "44px", height: "44px", borderRadius: "var(--radius-md)", flexShrink: 0 }} />
            <div>
              <div id="analyst-drawer-client-name" style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-primary)" }}>Demandeur</div>
              <div id="analyst-drawer-client-activity" style={{ fontSize: "0.76rem", color: "var(--text-secondary)" }}>—</div>
              <div id="analyst-drawer-client-loc" style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "1px" }}>
                <i className="fas fa-location-dot text-primary mr-1"></i> —
              </div>
            </div>
          </div>

          {/* Équation financière Reste à Vivre */}
          <div style={{ background: "var(--bg-surface-secondary)", padding: "0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)", marginBottom: "0.75rem" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "0.5rem" }}>
              <i className="fas fa-calculator text-primary mr-1"></i> Décomposition de la Capacité Nette
            </div>
            <div className="drawer-grid-2" style={{ marginBottom: "0.5rem" }}>
              <div className="drawer-kv">
                <span className="drawer-kv-label">Revenus Mensuels</span>
                <span id="analyst-drawer-income" className="drawer-kv-value" style={{ color: "#518e45", fontWeight: 700 }}>—</span>
              </div>
              <div className="drawer-kv">
                <span className="drawer-kv-label">Charges & Dettes</span>
                <span id="analyst-drawer-expenses" className="drawer-kv-value" style={{ color: "#dc2626", fontWeight: 700 }}>—</span>
              </div>
            </div>
            <div className="drawer-grid-2" style={{ paddingTop: "0.4rem", borderTop: "1px dashed var(--border-color)" }}>
              <div className="drawer-kv">
                <span className="drawer-kv-label">Reste à Vivre Dégagé</span>
                <span id="analyst-drawer-disposable" className="drawer-kv-value" style={{ color: "var(--primary-700)", fontWeight: 800, fontSize: "0.95rem" }}>—</span>
              </div>
              <div className="drawer-kv">
                <span className="drawer-kv-label">Mensualité Prévue</span>
                <span id="analyst-drawer-installment" className="drawer-kv-value" style={{ fontWeight: 800, fontSize: "0.95rem" }}>—</span>
              </div>
            </div>
          </div>

          <div id="analyst-drawer-cap-banner" className="capacity-comparison pass" style={{ margin: 0, padding: "0.5rem 0.75rem", borderRadius: "var(--radius-sm)", fontSize: "0.75rem" }}>
            {/* Injected dynamically */}
          </div>
        </div>

        {/* Section 2 : Conformité des pièces */}
        <div className="drawer-panel">
          <div className="drawer-panel-header">
            <h4 className="drawer-panel-title"><i className="fas fa-file-invoice text-primary mr-1"></i> Lecture et conformité des pièces</h4>
            <span id="analyst-drawer-docs-count" className="badge badge-submitted" style={{ fontSize: "0.68rem" }}>0 document</span>
          </div>
          <div id="analyst-drawer-docs-list" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {/* Rendered Docs */}
          </div>
        </div>

        {/* Section 3 : Alertes & Détection des Anomalies */}
        <div className="drawer-panel">
          <div className="drawer-panel-header">
            <h4 className="drawer-panel-title"><i className="fas fa-triangle-exclamation text-warning mr-1"></i> Points de contrôle</h4>
            <span id="analyst-drawer-anom-count" className="badge badge-warning" style={{ fontSize: "0.68rem" }}>0 alerte</span>
          </div>
          <div id="analyst-drawer-anomalies-list" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {/* Rendered Anomalies */}
          </div>
        </div>

        {/* Avis pour le comité, sans score */}
        <div className="drawer-panel">
          <div className="drawer-panel-header">
            <h4 className="drawer-panel-title"><i className="fas fa-pen-to-square text-emerald mr-1"></i> Avis pour le comité</h4>
            <span className="badge badge-submitted" style={{ fontSize: "0.68rem" }}>Comité d'Octroi</span>
          </div>
          <div className="form-group" style={{ marginBottom: "0.75rem" }}>
            <label className="form-label" style={{ fontSize: "0.75rem" }}>Avis Consultatif</label>
            <CfSelect id="analyst-drawer-reco-select" className="form-control" style={{ fontSize: "0.8rem" }} defaultValue="FAVORABLE">
              <option value="FAVORABLE">Favorable pour passage en Comité</option>
              <option value="RESERVED">Favorable sous réserve de compléments</option>
              <option value="UNFAVORABLE">Défavorable (Risque trop élevé)</option>
            </CfSelect>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: "0.75rem" }}>Note d'Analyse Synthétique</label>
            <textarea id="analyst-drawer-notes-input" className="form-control" rows={2} style={{ fontSize: "0.78rem" }} placeholder="Synthèse pour les membres du comité..." />
          </div>
        </div>
      </div>

      {/* Sidedrawer Footer Actions */}
      <div className="schedule-drawer-footer" style={{ justifyContent: "center", flexDirection: "column", alignItems: "stretch" }}>
        <p id="analyst-drawer-lock" hidden style={{ margin: "0 0 0.55rem", fontSize: "0.78rem", color: "var(--text-muted)" }} />
        <div id="analyst-drawer-review-actions">
          <button type="button" className="btn btn-secondary btn-sm analyst-footer-wide" id="analyst-drawer-btn-360" onClick={() => callApp("openAnalyst360Modal")}>
            <i className="fas fa-magnifying-glass-chart mr-1"></i> Analyser 360°
          </button>
          <button type="button" className="btn btn-primary btn-sm analyst-footer-wide" id="analyst-drawer-btn-committee" onClick={() => callApp("submitAnalystReviewFromDrawer")}>
            <i className="fas fa-paper-plane mr-1"></i> Transmettre au comité
          </button>
        </div>
      </div>
    </div>
  </div>
    </>
  );
}
