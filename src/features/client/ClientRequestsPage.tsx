import { Screen } from "@/shared/ui/Screen";
import { Button } from "@/shared/ui/Button";
import { StatCard } from "@/shared/ui/StatCard";
import { callApp } from "@/shared/ui/legacy";
import { CreditWorkflowBoard } from "@/features/workflow/CreditWorkflowBoard";
import { useCreditRequests } from "@/features/workflow/useCreditRequests";
import { isCommitteeGranted } from "@/features/loans/granted";
import { complementSubjectLabel } from "@/api/credit";

const CLOSED = new Set(["DRAFT", "APPROVED", "AMENDED", "REJECTED", "VERIFICATION_REQUIRED", "ADJOURNED"]);

export function ClientRequestsPage() {
  const { items, loading } = useCreditRequests("mine");
  const count = (value: number) => (loading ? "…" : String(value));
  const waiting = items.filter(
    (row) => (row.status || "").toUpperCase() === "VERIFICATION_REQUIRED",
  );
  const adjourned = items.filter(
    (row) => (row.status || "").toUpperCase() === "ADJOURNED",
  );
  const granted = items.filter((row) => isCommitteeGranted(row.status));
  const drafts = items.filter(
    (row) => (row.status || "").toUpperCase() === "DRAFT",
  );
  const inProgress = items.filter(
    (row) => !CLOSED.has((row.status || "").toUpperCase()),
  );

  return (
    <Screen viewId="view-client-requests">
      <div className="page-header">
        <div>
          <h2 className="page-title">
            <i className="fas fa-folder-tree text-primary mr-2"></i> Mes
            demandes
          </h2>
          <p className="page-subtitle">
            Suivi de vos dossiers : envoi à l’agent, compléments, puis analyse.
            Un accord du comité ouvre l’échéancier.
          </p>
        </div>
        <div className="page-actions">
          <Button onClick={() => callApp("openNewLoanModal")}>
            <i className="fas fa-plus-circle"></i> Déposer une demande
          </Button>
        </div>
      </div>

      {waiting.length ? (
        <div
          className="card"
          style={{
            marginBottom: "1rem",
            borderColor: "rgba(180, 83, 9, 0.45)",
            background: "rgba(255, 152, 0, 0.12)",
          }}
        >
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <p style={{ margin: 0, fontWeight: 700 }}>
              {waiting.length} demande{waiting.length > 1 ? "s" : ""} de complément à traiter en priorité
            </p>
            {waiting.map((row) => (
              <div
                key={row.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "1rem",
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <p style={{ margin: 0, fontSize: "0.86rem" }}>
                  <strong>Dossier #{row.id} — {complementSubjectLabel(row.complement_subject)}</strong>
                  <br />
                  {row.complement_detail || "Votre agence attend un complément avant de poursuivre."}
                </p>
                <Button
                  className="btn-sm"
                  onClick={() => callApp("openClientRequestDrawer", row.id)}
                >
                  Répondre
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {adjourned.length ? (
        <div className="card" style={{ marginBottom: "1rem", borderColor: "rgba(180, 83, 9, 0.45)", background: "rgba(255, 152, 0, 0.08)" }}>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <p style={{ margin: 0, fontWeight: 700 }}>
              {adjourned.length} demande{adjourned.length > 1 ? "s" : ""} ajournée{adjourned.length > 1 ? "s" : ""} par le comité
            </p>
            {adjourned.map((row) => (
              <p key={row.id} style={{ margin: 0, fontSize: "0.86rem" }}>
                <strong>Dossier #{row.id}</strong>
                <br />
                Pourquoi : {row.adjourn_reason || "—"}
                <br />
                Quoi : {row.adjourn_what || "—"}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid-4" style={{ marginBottom: "1.25rem" }}>
        <StatCard
          tone="primary"
          icon="fa-folder-open"
          value={count(items.length)}
          label="Toutes les demandes"
          trend={<>Dossiers déposés</>}
        />
        <StatCard
          tone="amber"
          icon="fa-pen"
          value={count(drafts.length)}
          label="Brouillons"
          trend={<>Non envoyés</>}
          trendUp={drafts.length === 0}
        />
        <StatCard
          tone="purple"
          icon="fa-hourglass-half"
          value={count(inProgress.length)}
          label="En cours"
          trend={<>Agent, analyste ou comité</>}
        />
        <StatCard
          tone="emerald"
          icon="fa-circle-check"
          value={count(granted.length)}
          label="Accordées"
          trend={<>Décision du comité</>}
        />
      </div>
      {drafts.length ? (
        <div
          className="card"
          style={{
            marginBottom: "1rem",
            borderColor: "rgba(59, 130, 246, 0.35)",
            background: "rgba(59, 130, 246, 0.08)",
          }}
        >
          <div
            className="card-body"
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "1rem",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: "0.86rem" }}>
              {drafts.length} brouillon{drafts.length > 1 ? "s" : ""} non envoyé
              {drafts.length > 1 ? "s" : ""}. Reprenez pour joindre une pièce et
              une garantie, puis envoyez à l’agent.
            </p>
            <Button
              className="btn-sm"
              onClick={() => callApp("resumeDraftCreditRequest", drafts[0].id)}
            >
              Reprendre
            </Button>
          </div>
        </div>
      ) : null}

      {granted.length ? (
        <div
          className="card"
          style={{
            marginBottom: "1rem",
            borderColor: "rgba(81, 142, 69, 0.35)",
            background: "rgba(81, 142, 69, 0.08)",
          }}
        >
          <div
            className="card-body"
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "1rem",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: "0.86rem" }}>
              {granted.length} crédit{granted.length > 1 ? "s" : ""} accordé
              {granted.length > 1 ? "s" : ""} par le comité. L’échéancier à
              régler est disponible.
            </p>
            <Button
              className="btn-sm"
              onClick={() => callApp("switchView", "view-client-schedule")}
            >
              Voir l’échéancier
            </Button>
          </div>
        </div>
      ) : null}

      <div className="card" style={{ padding: "1rem 1.15rem 1.15rem" }}>
        <CreditWorkflowBoard
          source="mine"
          heading="Mes dossiers"
          onOpen={(id) => {
            const row = items.find((item) => String(item.id) === String(id));
            if (row && isCommitteeGranted(row.status)) {
              callApp("switchView", "view-client-schedule");
              return;
            }
            callApp("openClientRequestDrawer", id);
          }}
        />
      </div>
    </Screen>
  );
}
