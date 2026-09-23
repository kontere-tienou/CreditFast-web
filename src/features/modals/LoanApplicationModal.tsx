import { useEffect, useState } from 'react';
import { AppModal } from '@/shared/ui/AppModal';
import { Button } from '@/shared/ui/Button';
import { CfSelect } from '@/shared/ui/CfSelect';
import { CfField } from '@/shared/ui/CfField';
import { callApp } from '@/shared/ui/legacy';
import { getUiSession } from '@/app/session';
import {
  CREDIT_PRODUCT_TYPES,
  creditProductLabel,
  listCreditProducts,
  type CreditProduct,
} from '@/api/credit';

function fallbackCreditProducts(): CreditProduct[] {
  return CREDIT_PRODUCT_TYPES.map((creditType) => ({
    credit_type: creditType,
    label: creditProductLabel(creditType),
  }));
}

function CreditProductsSelect() {
  const [products, setProducts] = useState<CreditProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    listCreditProducts()
      .then((rows) => {
        if (mounted) {
          setProducts(rows.length ? rows : fallbackCreditProducts());
        }
      })
      .catch(() => {
        if (mounted) {
          setProducts(fallbackCreditProducts());
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <CfSelect id="wiz-credit-type" className="form-control" defaultValue="" disabled={loading && !products.length}>
      <option value="">{loading ? 'Chargement des types de crédit…' : 'Sélectionner un type de crédit'}</option>
      {products.map((product) => (
        <option key={product.credit_type} value={product.credit_type}>
          {creditProductLabel(product)}
        </option>
      ))}
    </CfSelect>
  );
}

function LoanWizardSessionPrefill() {
  useEffect(() => {
    const session = getUiSession();
    const name = document.getElementById('wiz-fullname') as HTMLInputElement | null;
    const phone = document.getElementById('wiz-phone') as HTMLInputElement | null;
    if (name && session?.name) {
      name.value = session.name;
    }
    if (phone && session?.phone) {
      phone.value = session.phone;
    }
    const bindFileName = (inputId: string, labelId: string, emptyLabel: string) => {
      const file = document.getElementById(inputId) as HTMLInputElement | null;
      const label = document.getElementById(labelId);
      const onFile = () => {
        if (label) {
          label.textContent = file?.files?.[0]?.name || emptyLabel;
        }
      };
      file?.addEventListener('change', onFile);
      return () => file?.removeEventListener('change', onFile);
    };
    const unbindDoc = bindFileName('wiz-doc-file', 'wiz-doc-file-name', 'Aucune pièce sélectionnée');
    const unbindGuarantee = bindFileName('wiz-guarantee-file', 'wiz-guarantee-file-name', 'Aucun justificatif de garantie sélectionné');
    return () => {
      unbindDoc();
      unbindGuarantee();
    };
  }, []);
  return null;
}

export function LoanApplicationModal() {
  return (
    <>
      <LoanWizardSessionPrefill />
{/* ====================================================================
     [MODAL] DEMANDE DE FINANCEMENT & CRÉDIT CREDITFAST (PARCOURS EN 6 ÉTAPES)
     Plateforme Régionale CreditFast UEMOA
     ==================================================================== */}
<AppModal id="modal-loan-application" parked size="xl" zIndex={2100}>

    {/* Modal Header */}
    <div className="modal-header" id="modal-loan-app-header" style={{ padding: "1.25rem 1.75rem", background: "linear-gradient(135deg, var(--cif-emerald-600, #518e45), var(--cif-emerald-700, #1b4332))", color: "white", borderBottom: "1px solid rgba(255, 255, 255, 0.1)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: "rgba(255, 255, 255, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem" }}>
          <i className="fas fa-file-circle-plus"></i>
        </div>
        <div>
          <h3 style={{ fontSize: "1.15rem", fontWeight: 800, margin: 0, color: "white", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span id="modal-loan-app-title">Faire une Demande de Prêt CreditFast</span>
            <span className="badge" id="modal-loan-app-badge" style={{ background: "rgba(255, 255, 255, 0.25)", color: "white", fontSize: "0.68rem", fontWeight: 600, padding: "2px 8px", borderRadius: "12px" }}>Parcours
              6 Étapes</span>
          </h3>
          <p id="modal-loan-app-subtitle" style={{ fontSize: "0.76rem", color: "#d1fae5", margin: "2px 0 0 0" }}>
            Instruction rapide, calcul transparent de votre mensualité & transmission sécurisée à votre conseiller
          </p>
        </div>
      </div>
      <button type="button" className="modal-close-btn" style={{ color: "white", background: "rgba(255,255,255,0.18)", border: "none", width: "34px", height: "34px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.2s" }} onClick={() => callApp("closeNewLoanModal")} title="Fermer la fenêtre">
        <i className="fas fa-times"></i>
      </button>
    </div>

    {/* Modal Body (Scrollable Wizard) */}
    <div className="modal-body" style={{ padding: "1.5rem 1.75rem", overflowY: "auto", flex: 1 }}>

      {/* 6-Step Indicator */}
      <div className="wizard-nav" style={{ marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "1px solid var(--border-color)" }}>
        <div className="wizard-step active" id="modal-wstep-1" onClick={() => callApp("setModalWizardStep", 1)} style={{ cursor: "pointer" }}>
          <div className="wizard-step-circle">1</div>
          <div className="wizard-step-label">Identité</div>
        </div>
        <div className="wizard-step" id="modal-wstep-2" onClick={() => callApp("setModalWizardStep", 2)} style={{ cursor: "pointer" }}>
          <div className="wizard-step-circle">2</div>
          <div className="wizard-step-label">Activité</div>
        </div>
        <div className="wizard-step" id="modal-wstep-3" onClick={() => callApp("setModalWizardStep", 3)} style={{ cursor: "pointer" }}>
          <div className="wizard-step-circle">3</div>
          <div className="wizard-step-label">Finances</div>
        </div>
        <div className="wizard-step" id="modal-wstep-4" onClick={() => callApp("setModalWizardStep", 4)} style={{ cursor: "pointer" }}>
          <div className="wizard-step-circle">4</div>
          <div className="wizard-step-label">Demande</div>
        </div>
        <div className="wizard-step" id="modal-wstep-5" onClick={() => callApp("setModalWizardStep", 5)} style={{ cursor: "pointer" }}>
          <div className="wizard-step-circle">5</div>
          <div className="wizard-step-label">Garantie</div>
        </div>
        <div className="wizard-step" id="modal-wstep-6" onClick={() => callApp("setModalWizardStep", 6)} style={{ cursor: "pointer" }}>
          <div className="wizard-step-circle">6</div>
          <div className="wizard-step-label">Justificatifs</div>
        </div>
      </div>

      {/* Step 1: Identité */}
      <div id="modal-wizard-step-1" className="modal-wizard-step-content">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
          <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>
            <i className="fas fa-id-card text-primary mr-2"></i> Étape 1 : Informations Personnelles
          </h4>
          <button type="button" className="btn btn-primary-subtle btn-sm" onClick={() => callApp("openQrScannerModal", 'identity')} title="Scanner le QR Code d'une pièce d'identité officielle">
            <i className="fas fa-camera text-primary mr-1"></i> <strong>Scanner QR / NINA (Caméra)</strong>
          </button>
        </div>

        {/* Verified QR Document Banner */}
        <div id="modal-wizard-identity-qr-badge" className="anomaly-item info" style={{ display: "none", marginBottom: "1.25rem" }}>
          <i className="fas fa-shield-halved anomaly-icon text-emerald" style={{ fontSize: "1.4rem" }}></i>
          <div className="anomaly-content">
            <h5 style={{ color: "var(--emerald, #518e45)", fontWeight: 700 }}>Pièce d'Identité Certifiée</h5>
            <p id="modal-wizard-identity-qr-text" style={{ fontSize: "0.8rem", margin: 0 }}>NINA Biométrique authentifiée
              avec succès.</p>
          </div>
          <button type="button" className="btn btn-outline btn-xs" onClick={() => callApp("openQrScannerModal", 'identity')} style={{ marginLeft: "auto" }}>
            <i className="fas fa-rotate"></i> Re-scanner
          </button>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600 }}>Nom et Prénom *</label>
            <input type="text" id="wiz-fullname" className="form-control" placeholder="Nom et prénom" required />
            <input type="hidden" id="wiz-draft-id" />
            <input type="hidden" id="wiz-activity-id" />
          </div>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600 }}>Numéro de Téléphone *</label>
            <input type="tel" id="wiz-phone" className="form-control" placeholder="+223 …" required />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600 }}>Pays de Résidence</label>
            <CfSelect id="wiz-country" className="form-control" defaultValue="Mali">
              <option value="Mali">Mali (Bamako)</option>
            </CfSelect>
          </div>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600 }}>Ville & Quartier / Zone</label>
            <input type="text" id="wiz-city" className="form-control" placeholder="Ville, quartier" />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1.5rem" }}>
          <Button type="button" onClick={() => callApp("setModalWizardStep", 2)}>
            Suivant : Activité <i className="fas fa-arrow-right ml-1"></i>
          </Button>
        </div>
      </div>

      {/* Step 2: Activité */}
      <div id="modal-wizard-step-2" className="modal-wizard-step-content" style={{ display: "none" }}>
        <h4 style={{ marginBottom: "1.25rem", fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>
          <i className="fas fa-store text-primary mr-2"></i> Étape 2 : Votre Activité Économique
        </h4>
        <div className="form-group">
          <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600 }}>Secteur d'Activité *</label>
          <CfSelect id="wiz-sector" className="form-control" defaultValue="">
            <option value="">Sélectionner un secteur</option>
            <option value="Commerce de Tissus & Habillement (Wax/Bazin)">Commerce de Tissus & Habillement
              (Wax/Bazin)</option>
            <option value="Artisanat & Menuiserie Bois">Artisanat & Menuiserie Bois</option>
            <option value="Transformation Agroalimentaire">Transformation Agroalimentaire</option>
            <option value="Commerce Général & Demi-Gros">Commerce Général & Demi-Gros</option>
            <option value="Aviculture & Élevage">Aviculture & Élevage</option>
            <option value="BTP & Quincaillerie">BTP & Quincaillerie</option>
          </CfSelect>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600 }}>Ancienneté de votre activité
              (Années)</label>
            <CfField kind="number" id="wiz-seniority" placeholder="0" />
          </div>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600 }}>Emplacement Commercial /
              Boutique</label>
            <input type="text" id="wiz-location" className="form-control" placeholder="Adresse de l’activité" />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1.5rem" }}>
          <Button type="button" variant="secondary" onClick={() => callApp("setModalWizardStep", 1)}><i className="fas fa-arrow-left mr-1"></i> Précédent</Button>
          <Button type="button" onClick={() => callApp("setModalWizardStep", 3)}>Suivant : Finances <i className="fas fa-arrow-right ml-1"></i></Button>
        </div>
      </div>

      {/* Step 3: Finances */}
      <div id="modal-wizard-step-3" className="modal-wizard-step-content" style={{ display: "none" }}>
        <h4 style={{ marginBottom: "0.4rem", fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>
          <i className="fas fa-calculator text-primary mr-2"></i> Étape 3 : Revenus, Charges & Capacité
        </h4>
        <p style={{ margin: "0 0 1.25rem", fontSize: "0.82rem", color: "var(--text-secondary)" }}>Revenu, dépenses et nombre de crédits en cours viennent du contrôle du compte. Ils ne se modifient pas ici.</p>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600 }}>Revenu Mensuel Moyen de l'Activité
              (FCFA)</label>
            <CfField kind="amount" id="wiz-income" readOnly defaultValue="0" />
          </div>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600 }}>Dépenses Mensuelles & Ménage (FCFA)</label>
            <CfField kind="amount" id="wiz-expenses" readOnly defaultValue="0" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600 }}>Nombre de crédits en cours</label>
            <CfField kind="number" id="wiz-debt" readOnly defaultValue="0" />
          </div>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600 }}>Nombre de personnes à charge</label>
            <CfField kind="number" id="wiz-dependents" placeholder="0" />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1.5rem" }}>
          <Button type="button" variant="secondary" onClick={() => callApp("setModalWizardStep", 2)}><i className="fas fa-arrow-left mr-1"></i> Précédent</Button>
          <Button type="button" onClick={() => callApp("setModalWizardStep", 4)}>Suivant : Demande <i className="fas fa-arrow-right ml-1"></i></Button>
        </div>
      </div>

      {/* Step 4: Demande */}
      <div id="modal-wizard-step-4" className="modal-wizard-step-content" style={{ display: "none" }}>
        <h4 style={{ marginBottom: "1.25rem", fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>
          <i className="fas fa-money-bill-wave text-primary mr-2"></i> Étape 4 : Détails du Financement Souhaité
        </h4>
        <div className="form-group">
          <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600 }}>Type de crédit compatible *</label>
          <CreditProductsSelect />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600 }}>Montant Demandé (FCFA) *</label>
            <CfField kind="amount" id="wiz-amount" placeholder="10 000" />
          </div>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600 }}>Durée Souhaitée (Mois) *</label>
            <CfField kind="number" id="wiz-duration" placeholder="12" />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600 }}>Objet précis de votre financement
            *</label>
          <textarea id="wiz-purpose" className="form-control" rows={2} placeholder="Objet du financement" />
        </div>

        {/* Live Capacity Simulator Card */}
        <div className="capacity-card" style={{ marginTop: "1rem", background: "var(--bg-body)", padding: "1rem", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-color)" }}>
          <h5 style={{ fontSize: "0.82rem", color: "var(--text-muted-dark)", marginBottom: "0.5rem", fontWeight: 700 }}>
            <i className="fas fa-calculator text-primary mr-1"></i> Estimation Instantanée de votre Confort Financier
          </h5>
          <div className="capacity-equation" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
            <div className="capacity-item">
              <div className="val" id="wiz-calc-disposable" style={{ fontSize: "1.1rem", fontWeight: 800, color: "#1b4332" }}>—</div>
              <div className="lbl" style={{ fontSize: "0.72rem", color: "var(--text-subtle)" }}>Reste à Vivre Disponible</div>
            </div>
            <div className="capacity-op" style={{ fontWeight: 700, color: "var(--text-subtle)" }}>vs</div>
            <div className="capacity-item">
              <div className="val" id="wiz-calc-installment" style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--primary-700)" }}>—</div>
              <div className="lbl" style={{ fontSize: "0.72rem", color: "var(--text-subtle)" }}>Mensualité Estimée</div>
            </div>
            <div className="capacity-item">
              <span id="wiz-calc-status" className="badge" style={{ fontSize: "0.76rem", padding: "6px 12px" }}>À calculer</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1.5rem" }}>
          <Button type="button" variant="secondary" onClick={() => callApp("setModalWizardStep", 3)}><i className="fas fa-arrow-left mr-1"></i> Précédent</Button>
          <Button type="button" onClick={() => callApp("setModalWizardStep", 5)}>Suivant : Garanties <i className="fas fa-arrow-right ml-1"></i></Button>
        </div>
      </div>

      {/* Step 5: Garanties */}
      <div id="modal-wizard-step-5" className="modal-wizard-step-content" style={{ display: "none" }}>
        <h4 style={{ marginBottom: "1.25rem", fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>
          <i className="fas fa-shield-alt text-primary mr-2"></i> Étape 5 : Déclaration de Garantie
        </h4>
        <div className="form-group">
          <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600 }}>Type de Garantie Proposée</label>
          <CfSelect id="wiz-guarantee-type" className="form-control" defaultValue="">
            <option value="">Choisissez une garantie (obligatoire)</option>
            <option value="BOUTIQUE">Boutique / stock / fonds de commerce</option>
            <option value="MATERIEL">Matériel ou équipement</option>
            <option value="CAUTION">Caution d’une personne</option>
            <option value="FONCIER">Terrain ou immeuble</option>
            <option value="EPARGNE">Épargne nantie</option>
          </CfSelect>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600 }}>Valeur Estimée de la Garantie
              (FCFA)</label>
            <CfField kind="amount" id="wiz-guarantee-val" placeholder="0" />
          </div>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600 }}>Description de la garantie</label>
            <input type="text" id="wiz-guarantee-desc" className="form-control" placeholder="Ex. moto, stock de tissus, caution d’un parent…" />
          </div>
        </div>
        <div style={{ border: "1px dashed var(--primary-300)", borderRadius: "var(--radius-lg)", padding: "1rem", background: "rgba(81, 142, 69, 0.08)", marginTop: "0.85rem" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", justifyContent: "space-between", flexWrap: "wrap" }}>
            <div style={{ minWidth: 0, flex: "1 1 280px" }}>
              <h5 style={{ margin: 0, fontSize: "0.88rem", fontWeight: 800, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "0.45rem" }}>
                <i className="fas fa-file-shield text-primary"></i> Justificatif de garantie
              </h5>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.76rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
                Ajoutez une photo, un reçu, une attestation, un titre foncier ou tout document prouvant la garantie déclarée.
              </p>
            </div>
            <Button type="button" variant="secondary" className="btn-sm" onClick={() => document.getElementById('wiz-guarantee-file')?.click()} style={{ flex: "0 0 auto" }}>
              <i className="fas fa-paperclip mr-1"></i> Joindre le justificatif
            </Button>
          </div>
          <input type="file" id="wiz-guarantee-file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }} />
          <p id="wiz-guarantee-file-name" style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: "0.65rem 0 0" }}>
            Aucun justificatif de garantie sélectionné
          </p>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1.5rem" }}>
          <Button type="button" variant="secondary" onClick={() => callApp("setModalWizardStep", 4)}><i className="fas fa-arrow-left mr-1"></i> Précédent</Button>
          <Button type="button" onClick={() => callApp("setModalWizardStep", 6)}>Suivant : Justificatifs &
            Signature <i className="fas fa-arrow-right ml-1"></i></Button>
        </div>
      </div>

      {/* Step 6: Justificatifs */}
      <div id="modal-wizard-step-6" className="modal-wizard-step-content" style={{ display: "none" }}>
        <h4 style={{ marginBottom: "1.25rem", fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>
          <i className="fas fa-file-arrow-up text-primary mr-2"></i> Étape 6 : Dépôt des justificatifs
        </h4>
        <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "-0.5rem", marginBottom: "1rem" }}>
          Après envoi, le système lit chaque pièce. L’agent confirme ensuite la conformité.
        </p>

        <div className="grid-2" style={{ gap: "1rem", marginBottom: "1.25rem" }}>
          {/* Option A: Scanner via Caméra QR Code */}
          <div style={{ border: "2px dashed var(--primary-300)", borderRadius: "var(--radius-lg)", padding: "1.25rem", textAlign: "center", background: "var(--bg-surface-secondary)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: "var(--primary-50)", color: "var(--primary-600)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem", margin: "0 auto 0.5rem" }}>
                <i className="fas fa-camera"></i>
              </div>
              <h5 style={{ marginBottom: "0.25rem", fontSize: "0.9rem", fontWeight: 700 }}>Scanner en Direct (Caméra)</h5>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
                Scannez le QR Code officiel de votre devis normalisé, facture DGI ou reçu.
              </p>
            </div>
            <Button type="button" className="btn-sm" onClick={() => callApp("showToast", 'Joignez plutôt un fichier PDF ou photo. Le scan n’est pas requis pour envoyer.', 'info')} style={{ width: "100%", justifyContent: "center" }}>
              <i className="fas fa-qrcode mr-2"></i> Lancer la Caméra & Scanner QR
            </Button>
          </div>

          {/* Option B: Téléverser un Fichier */}
          <div style={{ border: "2px dashed var(--border-color)", borderRadius: "var(--radius-lg)", padding: "1.25rem", textAlign: "center", background: "var(--bg-surface-secondary)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: "var(--bg-surface)", color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem", margin: "0 auto 0.5rem", border: "1px solid var(--border-color)" }}>
                <i className="fas fa-file-pdf"></i>
              </div>
              <h5 style={{ marginBottom: "0.25rem", fontSize: "0.9rem", fontWeight: 700 }}>Joindre un Fichier (PDF / Photo)
              </h5>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
                Facture, quittance, contrat de bail ou justificatif de revenu (PDF, JPEG ou PNG).
              </p>
            </div>
            <CfSelect id="wiz-doc-type" className="form-control" defaultValue="PREUVE_REVENU" style={{ marginBottom: "0.65rem" }}>
              <option value="PREUVE_REVENU">Justificatif de revenu</option>
              <option value="JUSTIFICATIF_DOMICILE">Justificatif de domicile</option>
              <option value="FACTURE_ELECTRICITE">Facture d’électricité</option>
              <option value="CONTRAT_BAIL">Contrat de bail</option>
              <option value="RELEVE_BANCAIRE">Relevé</option>
              <option value="CNI">Pièce d’identité</option>
            </CfSelect>
          <Button type="button" variant="secondary" className="btn-sm" onClick={() => document.getElementById('wiz-doc-file')?.click()} style={{ width: "100%", justifyContent: "center" }}>
              <i className="fas fa-folder-open mr-2"></i> Parcourir Fichiers...
            </Button>
            <input type="file" id="wiz-doc-file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }} />
            <p id="wiz-doc-file-name" style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: "0.5rem 0 0" }}>Aucune pièce sélectionnée</p>
          </div>
        </div>

        {/* Scanned Document Banner if available */}
        <div id="modal-wizard-doc-qr-badge" className="anomaly-item info" style={{ display: "none", marginBottom: "1.25rem" }}>
          <i className="fas fa-file-circle-check anomaly-icon text-emerald" style={{ fontSize: "1.4rem" }}></i>
          <div className="anomaly-content">
            <h5 style={{ color: "var(--emerald, #518e45)", fontWeight: 700 }}>Document Officiel Vérifié par QR Code</h5>
            <p id="modal-wizard-doc-qr-text" style={{ fontSize: "0.8rem", margin: 0 }}>Facture certifiée attachée avec
              succès au dossier.</p>
          </div>
        </div>

        {/* Consent Checkbox */}
        <div style={{ background: "rgba(81, 142, 69, 0.08)", borderRadius: "var(--radius-md)", padding: "0.85rem 1rem", border: "1px solid rgba(81, 142, 69, 0.25)", marginBottom: "1.25rem" }}>
          <label style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", cursor: "pointer", margin: 0, fontSize: "0.78rem", color: "var(--text-primary)" }}>
            <input type="checkbox" id="modal-wiz-consent" defaultChecked style={{ marginTop: "2px", accentColor: "var(--cif-emerald-500)" }} />
            <span>
              Je certifie l'exactitude des informations fournies et j'autorise la Caisse CreditFast à instruire ma
              demande de financement selon les normes.
            </span>
          </label>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1.5rem", borderTop: "1px solid var(--border-color)", paddingTop: "1rem" }}>
          <Button type="button" variant="secondary" onClick={() => callApp("setModalWizardStep", 5)}><i className="fas fa-arrow-left mr-1"></i> Précédent</Button>
          <Button type="button" variant="secondary" onClick={() => callApp("saveDraftCreditRequest")}>
            <i className="fas fa-floppy-disk mr-1"></i> Enregistrer le brouillon
          </Button>
          <Button type="button" id="modal-loan-app-submit-btn" variant="success" className="btn-lg" onClick={() => callApp("submitNewCreditRequest")}>
            <i className="fas fa-paper-plane mr-2"></i> Confirmer & Soumettre ma Demande
          </Button>
        </div>
      </div>

    </div>
</AppModal>
    </>
  );
}
