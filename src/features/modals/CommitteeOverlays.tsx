import { useState } from 'react';
import { AppModal } from '@/shared/ui/AppModal';
import { Button } from '@/shared/ui/Button';
import { CfSelect } from '@/shared/ui/CfSelect';
import { CfField } from '@/shared/ui/CfField';
import { callApp } from '@/shared/ui/legacy';
import { CommitteeRefusalAlert } from '@/features/committee/CommitteeRefusalAlert';

export function CommitteeOverlays() {
  const [refusalOpen, setRefusalOpen] = useState(false);
  return (
    <>
{/* ==========================================================================
     MODAL: COMITÉ DE CRÉDIT & CONFORMITÉ - DÉLIBÉRATION COLLÉGIALE
     ========================================================================== */}
<AppModal id="committee-modal" parked size="lg" className="committee-modal-dialog">
    
    {/* Modal Header with Identity & Quorum */}
    <div className="modal-header" style={{ padding: "1.25rem 1.5rem", background: "linear-gradient(135deg, rgba(27, 67, 50, 0.04) 0%, rgba(139, 92, 246, 0.08) 100%)", borderBottom: "1px solid var(--border-color)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
        <div style={{ width: "44px", height: "44px", borderRadius: "var(--radius-md)", background: "var(--primary-50)", color: "var(--primary-600)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem", boxShadow: "var(--shadow-sm)" }}>
          <i className="fas fa-gavel"></i>
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
              Délibération du Comité de Crédit
            </h3>
            <span className="badge badge-submitted" id="com-dossier-num" style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>—</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "3px" }}>
            <span id="com-client-name"><i className="fas fa-user mr-1"></i> —</span>
            <span>•</span>
            <span style={{ color: "#518e45", fontWeight: 600 }}><i className="fas fa-users-viewfinder mr-1"></i> Vote du comité</span>
          </div>
        </div>
      </div>
      <button type="button" className="modal-close-btn" onClick={() => callApp("closeCommitteeModal")} title="Fermer la délibération">&times;</button>
    </div>

    {/* Modal Body */}
    <div className="modal-body" style={{ padding: "1.5rem" }}>
      
      <div className="com-decision-facts">
        <div className="com-score-card">
          <div className="com-score-kicker">Score et recommandation</div>
          <div className="com-score-gauge" id="com-score-gauge">
            <div className="com-score-gauge-track">
              <span id="com-score-marker" className="com-score-marker is-hidden"></span>
            </div>
            <div className="com-score-gauge-scale"><span>0</span><span>100</span></div>
          </div>
          <div className="com-score-split">
            <div className="com-score-line">
              <span id="com-score-value">—</span>
              <span className="com-score-max">/100</span>
            </div>
            <div className="com-score-aside">
              <div id="com-risk-level" className="com-score-reco">—</div>
              <p id="com-score-note" className="com-score-note">
                Le score sur 100 et la recommandation restent uniquement ici. Le calcul se fait à l’arrivée du dossier au comité.
              </p>
            </div>
          </div>
        </div>
        <div className="grid-2" style={{ gap: "1rem" }}>
        <div className="card" style={{ padding: "0.9rem 1rem", background: "var(--bg-surface)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)" }}>
          <div style={{ fontSize: "0.72rem", textTransform: "uppercase", fontWeight: 700, color: "var(--text-muted)", marginBottom: "0.25rem" }}>
            Montant Demandé
          </div>
          <div id="com-requested-amount" className="amount-cell" style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--primary-700)" }}>
            —
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
            Durée : <strong id="com-requested-duration">—</strong>
          </div>
        </div>

        {/* Capacité & Reste à Vivre */}
        <div className="card" style={{ padding: "0.9rem 1rem", background: "var(--bg-surface)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)" }}>
          <div style={{ fontSize: "0.72rem", textTransform: "uppercase", fontWeight: 700, color: "var(--text-muted)", marginBottom: "0.25rem" }}>
            Capacité de Remboursement
          </div>
          <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--text-primary)" }} id="com-disposable-income">
            —
          </div>
          <div style={{ fontSize: "0.75rem", color: "#518e45", fontWeight: 600, marginTop: "2px" }}>
            <i className="fas fa-circle-check"></i> Capacité après charges
          </div>
        </div>
        </div>
      </div>

      {/* 2. Avis de Synthèse de l'Analyste & Surveillance LBC */}
      <div style={{ background: "rgba(27, 67, 50, 0.05)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", padding: "0.85rem 1rem", marginBottom: "1.5rem", display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
        <i className="fas fa-file-signature text-primary" style={{ fontSize: "1.1rem", marginTop: "2px" }}></i>
        <div style={{ fontSize: "0.82rem", lineHeight: 1.5, color: "var(--text-secondary)", flex: 1 }}>
          <div style={{ fontWeight: 700, color: "var(--primary-800)", marginBottom: "2px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Avis de l’analyste</span>
            <span className="badge badge-approved" style={{ fontSize: "0.68rem" }}><i className="fas fa-clipboard-check"></i> Instruction reçue</span>
          </div>
          <span id="com-analyst-notes">—</span>
        </div>
      </div>

      {/* 3. Ajustement des Termes Accordés */}
      <div className="card" style={{ padding: "1.25rem", background: "var(--bg-surface-secondary)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h4 style={{ fontSize: "0.92rem", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
            <i className="fas fa-sliders text-primary mr-1"></i> Paramètres du Prêt Validés par le Comité
          </h4>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Ajustables en séance</span>
        </div>

        <div className="grid-3" style={{ gap: "1rem", marginBottom: "1rem" }}>
          {/* Montant Accordé */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontWeight: 700, fontSize: "0.8rem" }}>Montant Accordé (FCFA)</label>
            <CfField kind="amount" id="com-approved-amount" defaultValue="" />
          </div>

          {/* Durée */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontWeight: 700, fontSize: "0.8rem" }}>Durée Validée (Mois)</label>
            <CfSelect id="com-approved-duration" className="form-control" defaultValue="12" style={{ fontWeight: 600 }}>
              <option value="6">6 Mois (Court terme)</option>
              <option value="12">12 Mois (Standard)</option>
              <option value="18">18 Mois (Moyen terme)</option>
              <option value="24">24 Mois (Investissement)</option>
            </CfSelect>
          </div>

          {/* Taux d'Intérêt */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontWeight: 700, fontSize: "0.8rem" }}>Taux Dégressif Annuel (%)</label>
            <CfField kind="decimal" id="com-interest-rate" defaultValue="15" />
          </div>
        </div>

        {/* Live Recalculation Bar */}
        <div style={{ background: "var(--bg-surface)", border: "1px dashed var(--border-color)", borderRadius: "var(--radius-sm)", padding: "0.75rem 1rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
            <i className="fas fa-calculator text-primary"></i>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Échéance Mensuelle Estimée :</span>
            <strong id="com-live-monthly-payment" style={{ fontSize: "1.05rem", color: "#518e45" }}>—</strong>
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            Part de la mensualité dans le revenu : <strong id="com-live-effort-ratio" style={{ color: "#518e45" }}>—</strong> (repère ≤ 33 %)
          </div>
        </div>

        {/* Conditions Particulières */}
        <div className="form-group" style={{ marginTop: "1rem", marginBottom: 0 }}>
          <label className="form-label" style={{ fontWeight: 600, fontSize: "0.8rem" }}>Conditions Particulières / Réserves éventuelles</label>
          <input type="text" id="com-conditions" className="form-control" defaultValue="" placeholder="Motif ou conditions (au moins 5 caractères)" />
        </div>
      </div>

      {/* 4. Décision Finale Collégiale (3 Cartes Intuitives) */}
      <div style={{ marginTop: "1.5rem" }}>
        <p id="com-consultation-note" hidden style={{ margin: "0 0 0.75rem", fontSize: "0.82rem", color: "var(--text-secondary)", textAlign: "center" }}>
          Ce dossier est déjà décidé. Il reste ouvert pour consultation : score, versement et échéancier.
        </p>
        <h4 style={{ fontSize: "0.92rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "0.75rem", textAlign: "center" }}>
          Vote & Décision Finale du Comité
        </h4>

        <div className="grid-3 committee-decision-cards-grid" style={{ gap: "1rem" }}>
          <div className="committee-action-card approve" onClick={() => callApp("submitCommitteeDecision", 'APPROVED')}>
            <div className="action-card-header">
              <div className="action-icon-wrap" style={{ background: "rgba(81, 142, 69, 0.15)", color: "#518e45" }}>
                <i className="fas fa-circle-check"></i>
              </div>
              <div className="action-title" style={{ color: "#1b4332" }}>Accorder tel que demandé</div>
            </div>
            <p className="action-desc">
              Valider le montant et la durée proposés. Le capital part sur le compte épargne et l’échéancier démarre.
            </p>
            <Button type="button" variant="success" className="w-full" style={{ fontWeight: 700, marginTop: "auto" }}>
              <i className="fas fa-signature mr-1"></i> Accorder
            </Button>
          </div>

          <div className="committee-action-card reserve" onClick={() => callApp("submitCommitteeDecision", 'AMENDED')}>
            <div className="action-card-header">
              <div className="action-icon-wrap" style={{ background: "rgba(255, 152, 0, 0.15)", color: "#ff9800" }}>
                <i className="fas fa-sliders"></i>
              </div>
              <div className="action-title" style={{ color: "#b45309" }}>Accorder avec conditions</div>
            </div>
            <p className="action-desc">
              Utilisez le montant ou la durée saisis ci-dessus, différents de la demande initiale.
            </p>
            <Button type="button" variant="warning" className="w-full" style={{ fontWeight: 700, marginTop: "auto" }}>
              <i className="fas fa-pen-to-square mr-1"></i> Accorder modifié
            </Button>
          </div>

          <div className="committee-action-card reject" onClick={() => setRefusalOpen(true)}>
            <div className="action-card-header">
              <div className="action-icon-wrap" style={{ background: "rgba(239, 68, 68, 0.15)", color: "#dc2626" }}>
                <i className="fas fa-circle-xmark"></i>
              </div>
              <div className="action-title" style={{ color: "#b91c1c" }}>Refuser le dossier</div>
            </div>
            <p className="action-desc">
              Ouvre l’alerte : pourquoi, quoi, puis ajourner ou renvoyer un complément à l’agent.
            </p>
            <Button type="button" variant="danger" className="w-full" style={{ fontWeight: 700, marginTop: "auto" }}>
              <i className="fas fa-ban mr-1"></i> Refuser
            </Button>
          </div>
        </div>
      </div>

    </div>
</AppModal>
<CommitteeRefusalAlert open={refusalOpen} onClose={() => setRefusalOpen(false)} />

{/* ==========================================================================
     SIDEDRAWER VOLET LATÉRAL : ANALYSE APPROFONDIE DU DOSSIER COMITÉ
     ========================================================================== */}
<div id="committee-drawer-backdrop" className="schedule-drawer-backdrop" onClick={() => callApp("closeCommitteeDrawer")}>
  <div id="committee-sidedrawer" className="schedule-drawer" onClick={(event) => event.stopPropagation()} aria-label="Volet détail dossier comité">
    <div className="schedule-drawer-header">
      <div className="schedule-drawer-header-content">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
          <span className="badge badge-submitted" id="com-drawer-req-badge" style={{ fontFamily: "var(--font-family-code)", fontWeight: 700 }}>—</span>
          <span id="com-drawer-risk-badge" className="badge badge-submitted"><i className="fas fa-shield-halved"></i> —</span>
          <span className="badge badge-committee" style={{ fontSize: "0.68rem" }}>Séance</span>
        </div>
        <h3 id="com-drawer-title" className="schedule-drawer-title" style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>—</h3>
        <p id="com-drawer-subtitle" className="schedule-drawer-subtitle" style={{ fontSize: "0.76rem", color: "var(--text-muted)", margin: 0, marginTop: "2px" }}>Dossier de crédit</p>
      </div>
      <button type="button" className="modal-close-btn" onClick={() => callApp("closeCommitteeDrawer")} title="Fermer le volet">
        <i className="fas fa-times"></i>
      </button>
    </div>

    <div className="schedule-drawer-body">
      {/* Section 1 : Emprunteur & Demande de Financement */}
      <div className="drawer-panel">
        <div className="drawer-panel-header">
          <h4 className="drawer-panel-title"><i className="fas fa-user-tie text-primary mr-1"></i> Fiche Emprunteur & Financement</h4>
          <span id="com-drawer-client-id" className="badge badge-submitted" style={{ fontSize: "0.68rem" }}>—</span>
        </div>
        <div style={{ display: "flex", gap: "0.85rem", alignItems: "center", marginBottom: "0.85rem" }}>
          <img id="com-drawer-avatar" src="https://ui-avatars.com/api/?name=Demandeur&background=1b4332&color=fff" alt="" className="user-avatar" style={{ width: "46px", height: "46px", borderRadius: "var(--radius-md)", flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div id="com-drawer-client-name" style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-primary)" }}>—</div>
            <div id="com-drawer-location" style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}><i className="fas fa-location-dot text-primary mr-1"></i> —</div>
          </div>
        </div>
        <div className="drawer-grid-2" style={{ marginBottom: "0.6rem" }}>
          <div className="drawer-metric-box">
            <div className="drawer-kv-label">Montant Sollicité</div>
            <div id="com-drawer-amount" style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--primary-700)", fontFamily: "var(--font-family-code)" }}>—</div>
            <div id="com-drawer-duration" style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>Durée : —</div>
          </div>
          <div className="drawer-metric-box">
            <div className="drawer-kv-label">Mensualité Estimée</div>
            <div id="com-drawer-installment" style={{ fontSize: "1.1rem", fontWeight: 800, color: "#1b4332", fontFamily: "var(--font-family-code)" }}>—</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>Mensualité estimée</div>
          </div>
        </div>
        <div className="drawer-grid-2">
          <div className="drawer-kv">
            <span className="drawer-kv-label">Activité Déclarée</span>
            <span id="com-drawer-activity" className="drawer-kv-value" style={{ fontWeight: 600 }}>—</span>
          </div>
          <div className="drawer-kv">
            <span className="drawer-kv-label">Reste à Vivre Mensuel</span>
            <span id="com-drawer-surplus" className="drawer-kv-value" style={{ color: "#518e45", fontWeight: 700 }}>—</span>
          </div>
        </div>
      </div>

      {/* Section 2 : Scoring IA Explicable & Piliers XAI */}
      <div className="drawer-panel">
        <div className="drawer-panel-header">
          <h4 className="drawer-panel-title"><i className="fas fa-chart-line text-emerald mr-1"></i> Score et recommandation</h4>
          <span id="com-drawer-conf-badge" className="badge badge-submitted"><i className="fas fa-check-double"></i> Confiance —</span>
        </div>
        <p style={{ margin: "0 0 0.75rem", fontSize: "0.76rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
          Le score sur 100 et la recommandation restent uniquement ici. Le calcul se fait à l’arrivée du dossier au comité.
        </p>
        <div className="com-score-gauge">
          <div className="com-score-gauge-track">
            <span id="com-drawer-score-marker" className="com-score-marker is-hidden"></span>
          </div>
          <div className="com-score-gauge-scale"><span>0</span><span>100</span></div>
        </div>
        <div className="com-score-line" style={{ marginTop: "0.35rem" }}>
          <span id="com-drawer-overall-score" style={{ fontSize: "2.2rem", fontWeight: 900, color: "#1b4332", letterSpacing: "-0.04em" }}>—</span>
          <span className="com-score-max">/100</span>
        </div>
        <div id="com-drawer-recommendation" className="com-score-reco">—</div>

        {/* Piliers XAI */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span><i className="fas fa-wallet text-primary mr-1"></i> Capacité de remboursement</span>
            <strong id="com-drawer-pillar-cashflow" style={{ color: "#518e45" }}>—</strong>
          </div>
          <div className="progress-bar-container" style={{ height: "5px", marginBottom: "3px" }}>
            <div id="com-drawer-bar-cashflow" className="progress-bar" style={{ width: "0%", background: "#518e45" }}></div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span><i className="fas fa-handshake text-info mr-1"></i> Garanties</span>
            <strong id="com-drawer-pillar-coldstart" style={{ color: "#518e45" }}>—</strong>
          </div>
          <div className="progress-bar-container" style={{ height: "5px", marginBottom: "3px" }}>
            <div id="com-drawer-bar-coldstart" className="progress-bar" style={{ width: "0%", background: "#3b82f6" }}></div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span><i className="fas fa-clock-rotate-left text-warning mr-1"></i> Historique & activité</span>
            <strong id="com-drawer-pillar-stability" style={{ color: "#518e45" }}>—</strong>
          </div>
          <div className="progress-bar-container" style={{ height: "5px" }}>
            <div id="com-drawer-bar-stability" className="progress-bar" style={{ width: "0%", background: "#ff9800" }}></div>
          </div>
        </div>
      </div>

      {/* Section 3 : Avis Analyste & Contrôle Conformité LBC/FT */}
      {/* <div class="drawer-panel">
        <div class="drawer-panel-header">
          <h4 class="drawer-panel-title"><i class="fas fa-clipboard-check text-info mr-1"></i> Avis Analyste & Filtrage LBC/FT</h4>
          <span class="badge badge-approved"><i class="fas fa-shield-check"></i> Conforme UEMOA</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 0.6rem; font-size: 0.78rem;">
          <div class="drawer-kv">
            <span class="drawer-kv-label">Recommandation Analyste Risque</span>
            <p id="com-drawer-analyst-notes" style="background: var(--bg-body); padding: 0.6rem 0.8rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); font-size: 0.75rem; color: var(--text-primary); margin: 0; line-height: 1.45;">
              Avis favorable. Chiffre d'affaires récurrent vérifié sur les 6 derniers mois. Caution solidaire validée par l'artisan référent.
            </p>
          </div>
          <div class="drawer-grid-2">
            <div class="drawer-kv">
              <span class="drawer-kv-label">Filtrage Sanctions & PPE</span>
              <span class="badge badge-approved" style="align-self: flex-start;"><i class="fas fa-check"></i> RAS (0% Match)</span>
            </div>
            <div class="drawer-kv">
              <span class="drawer-kv-label">Gage & Sûretés</span>
              <span class="badge badge-submitted" style="align-self: flex-start;"><i class="fas fa-file-contract"></i> Acte RCCM Enregistré</span>
            </div>
          </div>
        </div>
      </div> */}

      <div className="drawer-panel">
        <div className="drawer-panel-header">
          <h4 className="drawer-panel-title"><i className="fas fa-clock-rotate-left text-primary mr-1"></i> Journal d'audit du dossier</h4>
          <span id="com-drawer-audit-badge" className="badge badge-submitted" style={{ fontSize: "0.68rem" }}>Avant vote</span>
        </div>
        <div id="com-drawer-audit-trail" className="audit-trail">
          {/* Dynamic audit trail */}
        </div>
      </div>
    </div>

    {/* Sidedrawer Footer Actions */}
    <div className="schedule-drawer-footer" style={{ padding: "1rem 1.4rem", borderTop: "1px solid var(--border-color)", background: "var(--bg-surface)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
      <button type="button" className="btn btn-secondary" onClick={() => callApp("closeCommitteeDrawer")} style={{ padding: "0.6rem 1rem" }}>
        <i className="fas fa-times mr-1"></i> Fermer
      </button>
      <p id="com-drawer-lock" hidden style={{ flexBasis: "100%", margin: 0, fontSize: "0.78rem", color: "var(--text-muted)" }} />
      <button type="button" id="com-drawer-btn-vote" className="btn btn-primary" onClick={() => callApp("openCommitteeModalFromDrawer")} style={{ padding: "0.6rem 1.25rem", fontWeight: 700 }}>
        <i className="fas fa-gavel mr-1"></i> Délibérer & Voter
      </button>
    </div>
  </div>
</div>
    </>
  );
}
