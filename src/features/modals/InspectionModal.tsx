import { AppModal } from '@/shared/ui/AppModal';
import { Button } from '@/shared/ui/Button';
import { CfSelect } from '@/shared/ui/CfSelect';
import { CfField } from '@/shared/ui/CfField';
import { callApp } from '@/shared/ui/legacy';

export function InspectionModal() {
  return (
    <>
{/* ====================================================================
     MODAL RAPPORT D'INSPECTION TERRAIN DES GARANTIES (AGENT DE CRÉDIT)
     ==================================================================== */}
<AppModal id="modal-inspection" parked size="lg">
    <div className="modal-header">
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "#fef3c7", color: "#ff9800", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>
          <i className="fas fa-clipboard-check"></i>
        </div>
        <div>
          <h3 className="modal-title" id="modal-insp-title">Rapport d'Inspection Terrain</h3>
          <div style={{ fontSize: "0.75rem", color: "var(--text-subtle)" }} id="modal-insp-subtitle">Contrôle physique, valorisation et solvabilité locale</div>
        </div>
      </div>
      <button type="button" className="modal-close" onClick={() => callApp("closeModal", 'modal-inspection')}>
        <i className="fas fa-xmark"></i>
      </button>
    </div>

    <div className="modal-body">
      <input type="hidden" id="insp-guarantee-id" defaultValue="" />
      
      {/* Guarantee info banner */}
      <div style={{ background: "var(--bg-body)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", padding: "0.85rem 1rem", marginBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-primary)" }} id="insp-client-name">—</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-subtle)" }} id="insp-guarantee-type">—</div>
          </div>
          <span className="badge badge-warning" id="insp-status-badge">À Visiter</span>
        </div>
      </div>

      {/* Form Inputs */}
      <div className="grid-2" style={{ gap: "1rem", marginBottom: "1rem" }}>
        <div className="form-group">
          <label className="form-label" style={{ fontSize: "0.8rem" }}>Valeur Déclarée (FCFA)</label>
          <CfField kind="amount" id="insp-declared-val" readOnly />
        </div>
        <div className="form-group">
          <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--primary-700)" }}>Valeur Expertisée / Retenue (FCFA) *</label>
          <CfField kind="amount" id="insp-verified-val" placeholder="Montant retenu après visite" />
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: "1rem" }}>
        <label className="form-label" style={{ fontSize: "0.8rem" }}>Localisation & Zone Visité Terrain *</label>
        <input type="text" id="insp-location" className="form-control" placeholder="Lieu visité" />
      </div>

      <div className="grid-2" style={{ gap: "1rem", marginBottom: "1rem" }}>
        <div className="form-group">
          <label className="form-label" style={{ fontSize: "0.8rem" }}>État Physique & Conservabilité *</label>
          <CfSelect id="insp-condition" className="form-control" defaultValue="">
            <option value="">Choisir</option>
            <option value="EXCELLENT">Excellent état / Neuf ou sous emballage</option>
            <option value="BON">Bon état / Rotation rapide de stock</option>
            <option value="MOYEN">État moyen / Vétusté partielle</option>
            <option value="MAUVAIS">Mauvais état / Risque de dépréciation</option>
          </CfSelect>
        </div>
        <div className="form-group">
          <label className="form-label" style={{ fontSize: "0.8rem" }}>Avis Enquête de Voisinage & Moralité *</label>
          <CfSelect id="insp-reputation" className="form-control" defaultValue="">
            <option value="">Choisir</option>
            <option value="TRES_FAVORABLE">Très favorable (Bonne notoriété au marché)</option>
            <option value="FAVORABLE">Favorable (Activité régulière constatée)</option>
            <option value="RESERVE">Réserves (Activité récente ou intermittente)</option>
          </CfSelect>
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: "1rem" }}>
        <label className="form-label" style={{ fontSize: "0.8rem" }}>Observations Détaillées de l'Agent *</label>
        <textarea id="insp-notes" className="form-control" rows={3} placeholder="Ce que vous avez constaté sur place" />
      </div>
    </div>

    <div className="modal-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <Button type="button" variant="secondary" onClick={() => callApp("closeModal", 'modal-inspection')}>Annuler</Button>
      <Button type="button" onClick={() => callApp("saveInspectionReport")}>
        <i className="fas fa-check-circle mr-1"></i> Valider le Contrôle Terrain
      </Button>
    </div>
</AppModal>
    </>
  );
}
