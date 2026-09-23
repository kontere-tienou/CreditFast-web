import { AppModal } from '@/shared/ui/AppModal';
import { Button } from '@/shared/ui/Button';
import { useState } from 'react';
import { callInteractions } from '@/shared/ui/legacy';
import { ComplementRequestDialog } from '@/features/workflow/ComplementRequestDialog';
import { submitStructuredComplement } from '@/features/agent/fillAgentDrawers';

export function AnalystDossierModal() {
  const [complementOpen, setComplementOpen] = useState(false);
  const [complementBusy, setComplementBusy] = useState(false);
  return (
    <>
    <AppModal id="dossier-modal" parked size="xl">
        <div className="modal-header">
          <div>
            <h3 id="modal-360-title" style={{ fontSize: "1.15rem", marginBottom: "2px" }}>
              <i className="fas fa-magnifying-glass-chart text-primary mr-1"></i> Analyse 360° <span id="modal-dossier-ref">—</span>
            </h3>
            <p style={{ fontSize: "0.78rem", color: "var(--text-subtle)" }} id="modal-client-location">—</p>
          </div>
          <button type="button" className="modal-close-btn" onClick={() => callInteractions("closeModal", 'dossier-modal')} title="Fermer l'analyse">&times;</button>
        </div>

        <div className="modal-body">
          <div className="capacity-card" style={{ marginBottom: "1.25rem" }}>
            <div>
              <h4 id="modal-client-name" style={{ fontSize: "1.2rem", color: "var(--text-main)", marginBottom: "2px" }}>—</h4>
              <div id="modal-client-activity" style={{ fontSize: "0.78rem", color: "var(--text-subtle)" }}>—</div>
            </div>
            <div className="capacity-equation">
              <div className="capacity-item">
                <div className="val" id="cap-income">—</div>
                <div className="lbl">Revenus</div>
              </div>
              <div className="capacity-op">-</div>
              <div className="capacity-item">
                <div className="val" id="cap-expenses">—</div>
                <div className="lbl">Charges</div>
              </div>
              <div className="capacity-op">=</div>
              <div className="capacity-item capacity-result">
                <div className="val" id="cap-disposable">—</div>
                <div className="lbl">Reste à vivre</div>
              </div>
              <div className="capacity-op">vs</div>
              <div className="capacity-item">
                <div className="val" id="cap-installment">—</div>
                <div className="lbl">Mensualité</div>
              </div>
            </div>
            <div id="cap-banner" className="capacity-comparison">—</div>
          </div>

          <div className="ocr-grid">
            <div>
              <h4 style={{ fontSize: "0.95rem", marginBottom: "0.75rem" }}>
                <i className="fas fa-file-invoice text-primary mr-1"></i> Pièces
              </h4>
              <div id="modal-docs-list">
                <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>Aucune pièce.</p>
              </div>
              <h4 style={{ fontSize: "0.95rem", margin: "1.25rem 0 0.75rem" }}>
                <i className="fas fa-triangle-exclamation text-warning mr-1"></i> Points de contrôle
              </h4>
              <div id="modal-anomalies-list">
                <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>Aucun signal.</p>
              </div>
            </div>
            <div>
              <h4 style={{ fontSize: "0.95rem", marginBottom: "0.75rem" }}>
                <i className="fas fa-pen-to-square text-primary mr-1"></i> Avis pour le comité
              </h4>
              <div className="card" style={{ background: "var(--surface-card-subtle)" }}>
                <div className="card-body" style={{ padding: "1rem" }}>
                  <p style={{ margin: "0 0 0.35rem", fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Avis consultatif</p>
                  <p id="modal-reco-text" style={{ margin: "0 0 0.85rem", fontWeight: 700, color: "var(--text-primary)" }}>—</p>
                  <p style={{ margin: "0 0 0.35rem", fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Note</p>
                  <p id="modal-notes-text" style={{ margin: 0, fontSize: "0.86rem", lineHeight: 1.45, color: "var(--text-secondary)" }}>—</p>
                </div>
              </div>
              <Button type="button" variant="secondary" id="analyst-360-btn-complement" style={{ width: "100%", marginTop: "0.85rem", borderRadius: "999px" }} onClick={() => setComplementOpen(true)}>
                <i className="fas fa-triangle-exclamation mr-1"></i> Demander des compléments
              </Button>
              <p style={{ margin: "0.85rem 0 0", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                L’avis se rédige dans le tiroir. La transmission au comité reste sur ce tiroir.
              </p>
            </div>
          </div>
        </div>
</AppModal>
    <ComplementRequestDialog
      open={complementOpen}
      busy={complementBusy}
      onClose={() => setComplementOpen(false)}
      onConfirm={(input) => {
        setComplementBusy(true);
        void submitStructuredComplement({ ...input, channel: 'analyst' }).then((ok) => {
          setComplementBusy(false);
          if (ok) setComplementOpen(false);
        });
      }}
    />
    </>
  );
}
