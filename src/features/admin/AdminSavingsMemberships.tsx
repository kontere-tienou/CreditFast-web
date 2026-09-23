import { useEffect, useState, type FormEvent } from "react";
import {
  listPendingMemberships,
  reviewMembership,
  type Membership,
} from "@/api/savings";
import { isApiError } from "@/api/errors";
import { membershipFieldLabels as labels } from "@/features/savings/membershipFields";
import "@/features/savings/savings.css";
import {
  membershipStatusLabel,
  SAVINGS_CHANGED,
} from "@/features/savings/workflow";

export function AdminSavingsMemberships() {
  const [rows, setRows] = useState<Membership[]>([]);
  const [filter, setFilter] = useState("PENDING");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setRows(await listPendingMemberships("ALL"));
    } catch (cause) {
      setError(
        isApiError(cause) && [404, 405, 501].includes(cause.status)
          ? "Le service de validation des adhésions épargne n’est pas encore disponible sur le serveur."
          : "Impossible de charger les adhésions. Réessayez.",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function review(event: FormEvent<HTMLFormElement>, row: Membership) {
    event.preventDefault();
    if (busy !== null) return;
    const data = new FormData(event.currentTarget);
    const decision =
      data.get("decision") === "REJECTED"
        ? "REJECTED"
        : data.get("decision") === "CHANGES_REQUESTED"
          ? "CHANGES_REQUESTED"
          : "APPROVED";
    const value = (key: string) => String(data.get(key) ?? "").trim();
    if (
      decision === "APPROVED" &&
      (!value("account_number") || !value("caisse_signature"))
    ) {
      setError(
        "Renseignez le numéro de compte et la signature de la caisse avant de valider.",
      );
      return;
    }
    if (decision !== "APPROVED" && !value("rejection_reason")) {
      setError("Indiquez le motif du refus ou les éléments à compléter.");
      return;
    }
    setBusy(row.id);
    setError("");
    setNotice("");
    try {
      await reviewMembership(row.id, row.client_type, {
        decision,
        ...(decision === "APPROVED"
          ? {
              account_number: value("account_number"),
              caisse_signature: value("caisse_signature"),
            }
          : decision === "REJECTED"
            ? { rejection_reason: value("rejection_reason") }
            : { correction_reason: value("rejection_reason") }),
      });
      await load();
      window.dispatchEvent(new Event(SAVINGS_CHANGED));
      setNotice(
        decision === "APPROVED"
          ? "Adhésion validée. Le compte épargne est actif."
          : decision === "REJECTED"
            ? "Adhésion refusée. Le demandeur pourra corriger sa fiche."
            : "Demande de compléments enregistrée.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Validation impossible.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="savings-admin" aria-labelledby="admin-savings-title">
      <h2 id="admin-savings-title">Adhésions épargne et historique</h2>
      <p>
        Examinez la fiche et les pièces justificatives avant d’activer le compte
        épargne.
      </p>
      <button
        className="btn btn-secondary"
        type="button"
        disabled={loading || busy !== null}
        onClick={() => void load()}
      >
        Actualiser
      </button>
      <div className="savings-grid">
        <label>
          Statut
          <select
            className="form-control"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            {[
              "ALL",
              "PENDING",
              "CHANGES_REQUESTED",
              "APPROVED",
              "REJECTED",
            ].map((status) => (
              <option key={status} value={status}>
                {status === "ALL"
                  ? "Tous les statuts"
                  : membershipStatusLabel(status)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Rechercher un demandeur
          <input
            className="form-control"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>
      {loading && <p role="status">Chargement des adhésions…</p>}
      {error && (
        <p role="alert" className="savings-error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {!loading &&
        !error &&
        !rows.some(
          (row) =>
            (filter === "ALL" || row.status === filter) &&
            row.applicant_name
              .toLocaleLowerCase()
              .includes(search.toLocaleLowerCase()),
        ) && <p>Aucune adhésion pour ces critères.</p>}
      {rows
        .filter(
          (row) =>
            (filter === "ALL" || row.status === filter) &&
            row.applicant_name
              .toLocaleLowerCase()
              .includes(search.toLocaleLowerCase()),
        )
        .map((row) => (
          <details key={row.id}>
            <summary>
              {row.applicant_name} —{" "}
              {row.client_type === "LEGAL_ENTITY"
                ? "Personne morale"
                : "Personne physique"}{" "}
              — {membershipStatusLabel(row.status)}
            </summary>
            <dl className="savings-review-values">
              {Object.entries(row.fields).map(([key, value]) => (
                <div key={key}>
                  <dt>
                    {labels[key] ??
                      (key === "signatory_count"
                        ? "Nombre de signataires"
                        : key)}
                  </dt>
                  <dd>{value || "—"}</dd>
                </div>
              ))}
            </dl>
            <h3>Pièces fournies</h3>
            <ul>
              {row.documents.map((doc) => (
                <li key={doc.id}>
                  {doc.label} — {doc.filename}
                </li>
              ))}
            </ul>
            <p>
              {row.reviewed_at
                ? `Décision du ${new Date(row.reviewed_at).toLocaleString("fr-FR")}`
                : ""}{" "}
              {row.reviewed_by || ""}
            </p>
            {(row.rejection_reason || row.correction_reason) && (
              <p>{row.rejection_reason || row.correction_reason}</p>
            )}
            {row.status === "PENDING" && (
              <form onSubmit={(event) => void review(event, row)}>
                <fieldset disabled={busy !== null} className="savings-section">
                  <legend>Décision de l’administrateur</legend>
                  <div className="savings-grid">
                    <label>
                      Décision
                      <select className="form-control" name="decision">
                        <option value="APPROVED">
                          Valider et activer le compte
                        </option>
                        <option value="CHANGES_REQUESTED">
                          Demander des compléments
                        </option>
                        <option value="REJECTED">Refuser l’adhésion</option>
                      </select>
                    </label>
                    <label>
                      N° de compte épargne
                      <input
                        className="form-control"
                        name="account_number"
                        maxLength={100}
                      />
                    </label>
                    <label>
                      Signature caisse (nom du responsable)
                      <input
                        className="form-control"
                        name="caisse_signature"
                        maxLength={200}
                      />
                    </label>
                    <label>
                      Motif du refus / éléments à compléter
                      <textarea
                        className="form-control"
                        name="rejection_reason"
                        maxLength={2000}
                      />
                    </label>
                  </div>
                  <label>
                    <input type="checkbox" required /> J’ai vérifié la fiche et
                    ses pièces justificatives et confirme cette décision.
                  </label>
                  <p>
                    <button className="btn btn-primary" type="submit">
                      {busy === row.id
                        ? "Enregistrement…"
                        : "Enregistrer la décision"}
                    </button>
                  </p>
                </fieldset>
              </form>
            )}
          </details>
        ))}
    </section>
  );
}
