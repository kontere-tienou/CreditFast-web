import { callApp } from '@/shared/ui/legacy';

export function ComplementsDrawer() {
  return (
<div id="complements-drawer-backdrop" className="schedule-drawer-backdrop" onClick={() => callApp("closeComplementsDrawer")}>
    <div id="complements-sidedrawer" className="schedule-drawer" onClick={(event) => event.stopPropagation()} aria-label="Volet détail pièce à collecter et relance">
      <div className="schedule-drawer-header">
        <div className="schedule-drawer-header-content">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
            <span className="badge badge-warning" id="comp-drawer-severity-badge"><i className="fas fa-triangle-exclamation"></i> Action Requise</span>
            <span id="comp-drawer-status-badge" className="badge badge-submitted">En Attente GED</span>
          </div>
          <h3 id="comp-drawer-title" className="schedule-drawer-title" style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Pièce requise</h3>
          <p id="comp-drawer-subtitle" className="schedule-drawer-subtitle" style={{ fontSize: "0.76rem", color: "var(--text-muted)", margin: 0, marginTop: "2px" }}>Régularisation documentaire et historique des relances</p>
        </div>
        <button type="button" className="modal-close-btn" onClick={() => callApp("closeComplementsDrawer")} title="Fermer le volet">
          <i className="fas fa-times"></i>
        </button>
      </div>

      <div className="schedule-drawer-body">
        {/* Section 1 : Emprunteur & Coordonnées */}
        <div className="drawer-panel">
          <div className="drawer-panel-header">
            <h4 className="drawer-panel-title"><i className="fas fa-user-circle text-primary mr-1"></i> Client Emprunteur</h4>
            <span id="comp-drawer-req-num" className="badge badge-submitted" style={{ fontFamily: "var(--font-family-code)", fontSize: "0.7rem" }}>—</span>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "0.75rem" }}>
            <img id="comp-drawer-client-avatar" src="https://ui-avatars.com/api/?name=Client&background=4f46e5&color=fff" alt="" className="user-avatar" style={{ width: "44px", height: "44px", borderRadius: "var(--radius-md)", flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div id="comp-drawer-client-name" style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-primary)" }}>Demandeur</div>
              <div id="comp-drawer-client-loc" style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>—</div>
            </div>
          </div>
          <div className="drawer-grid-2">
            <div className="drawer-kv">
              <span className="drawer-kv-label"><i className="fas fa-phone text-emerald mr-1"></i> Téléphone</span>
              <span id="comp-drawer-client-phone" className="drawer-kv-value" style={{ fontFamily: "var(--font-family-code)", fontWeight: 600 }}>—</span>
            </div>
            <div className="drawer-kv">
              <span className="drawer-kv-label"><i className="fas fa-coins text-warning mr-1"></i> Montant Demandé</span>
              <span id="comp-drawer-loan-amount" className="drawer-kv-value" style={{ color: "var(--primary-700)", fontFamily: "var(--font-family-code)", fontWeight: 700 }}>—</span>
            </div>
          </div>
        </div>

        {/* Section 2 : Détail du blocage et action attendue */}
        <div className="drawer-panel">
          <div className="drawer-panel-header">
            <h4 className="drawer-panel-title"><i className="fas fa-file-circle-exclamation text-danger mr-1"></i> Blocage & Action Attendue</h4>
            <span id="comp-drawer-doc-type" className="badge badge-submitted" style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem" }}>PIECE</span>
          </div>
          <div style={{ marginBottom: "0.65rem" }}>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.25rem" }} id="comp-drawer-doc-name">
              Complément à fournir
            </div>
            <div style={{ background: "rgba(239, 68, 68, 0.08)", borderLeft: "3px solid #ef4444", padding: "0.6rem 0.8rem", borderRadius: "0 var(--radius-sm) var(--radius-sm) 0", fontSize: "0.76rem", color: "#991b1b", lineHeight: 1.45 }} id="comp-drawer-reason">
              Le motif sera renseigné depuis le dossier.
            </div>
          </div>
          <div style={{ background: "var(--bg-body)", padding: "0.65rem 0.85rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", fontSize: "0.74rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
              <span style={{ color: "var(--text-muted)" }}>Impact sur le Scoring :</span>
              <strong id="comp-drawer-impact" style={{ color: "#b91c1c", textAlign: "right" }}>Score documentaire incomplet</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>Délai de régularisation :</span>
              <span id="comp-drawer-deadline" style={{ fontWeight: 600, color: "var(--text-primary)", textAlign: "right" }}>48 heures ouvrées</span>
            </div>
          </div>
        </div>

        {/* Section 3 : Historique des Relances Client */}
        <div className="drawer-panel">
          <div className="drawer-panel-header">
            <h4 className="drawer-panel-title"><i className="fas fa-paper-plane text-info mr-1"></i> Journal des Relances</h4>
            <span id="comp-drawer-reminders-count" className="badge badge-submitted">0 relance</span>
          </div>
          <div id="comp-drawer-timeline" className="reminder-journal">
            <div className="reminder-empty">Aucune relance tracée pour ce dossier.</div>
          </div>
        </div>

        {/* Section 4 : Régularisation & Téléversement Direct */}
        <div className="drawer-panel">
          <div className="drawer-panel-header">
            <h4 className="drawer-panel-title"><i className="fas fa-cloud-arrow-up text-primary mr-1"></i> Réceptionner la Pièce Directement</h4>
          </div>
          <div style={{ border: "2px dashed var(--border-color)", borderRadius: "var(--radius-md)", padding: "1rem", textAlign: "center", background: "var(--bg-body)", cursor: "pointer" }} onClick={() => callApp("triggerDrawerFileUpload")}>
            <i className="fas fa-file-circle-plus text-primary" style={{ fontSize: "1.6rem", marginBottom: "0.35rem", display: "block" }}></i>
            <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-primary)", display: "block" }}>Scan agence / dépôt GED</span>
            <span style={{ fontSize: "0.7rem", color: "var(--text-subtle)" }}>Prévu pour le mobile agent et la GED connectée</span>
          </div>
        </div>
      </div>

      {/* Sidedrawer Footer Actions */}
      <div className="schedule-drawer-footer">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => callApp("closeComplementsDrawer")}>Fermer</button>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button type="button" id="comp-drawer-btn-remind" className="btn btn-secondary btn-sm" onClick={() => callApp("triggerReminderFromDrawer")}>
            <i className="fas fa-paper-plane text-primary mr-1"></i> Relancer client
          </button>
          <button type="button" id="comp-drawer-btn-validate" className="btn btn-primary btn-sm" onClick={() => callApp("markDocReceivedFromDrawer")}>
            <i className="fas fa-check mr-1"></i> Valider & Conforme
          </button>
        </div>
      </div>
    </div>
  </div>
  );
}
