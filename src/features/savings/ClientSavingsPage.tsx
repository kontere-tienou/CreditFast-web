import { useEffect, useState } from "react";
import {
  fetchClientProfile,
  hasActiveSavingsAccount,
  type ClientProfile,
} from "@/api/profile";
import { getMembership, type Membership } from "@/api/savings";
import { Screen } from "@/shared/ui/Screen";
import { PageHeader } from "@/shared/ui/PageHeader";
import { isSavingsAccount } from "./accountPolicy";
import { membershipFieldLabels } from "./membershipFields";
import { SavingsAccountOverview } from './SavingsAccountOverview';
import {
  OPEN_SAVINGS,
  SAVINGS_CHANGED,
  membershipStatusLabel,
} from "./workflow";
import "./savings.css";

export function ClientSavingsPage() {
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const next = await fetchClientProfile();
        if (!mounted) return;
        setProfile(next);
        const current = hasActiveSavingsAccount(next) ? null : await getMembership(next?.client_type);
        if (!mounted) return;
        setMembership(current);
      } catch {
        if (mounted) setError('Vérification indisponible. Actualisez pour réessayer.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    window.addEventListener(SAVINGS_CHANGED, load);
    return () => {
      mounted = false;
      window.removeEventListener(SAVINGS_CHANGED, load);
    };
  }, []);
  const active = hasActiveSavingsAccount(profile);
  const editable =
    !membership ||
    ["REJECTED", "CHANGES_REQUESTED"].includes(membership.status);
  return (
    <Screen viewId="view-client-savings">
      <PageHeader
        title="Mon compte épargne"
        crumbs={["Mon espace", "Compte épargne"]}
      />
      <section className="savings-workspace">
        {loading && <p role="status">Chargement…</p>}
        {error && <p role="alert">{error}</p>}
        {!loading && !error && (
          <>
            {!active && <h2 className="savings-workspace-status">
              {membership
                  ? `Adhésion : ${membershipStatusLabel(membership.status)}`
                  : "Ouverture de compte épargne"}
            </h2>}
            {profile?.financial_accounts
              ?.filter(isSavingsAccount)
              .map((account) => (
                <SavingsAccountOverview key={account.id ?? account.account_number} account={account} profile={profile!} />
              ))}
            {membership?.rejection_reason && (
              <p>Motif du refus : {membership.rejection_reason}</p>
            )}
            {membership?.correction_reason && (
              <p>Éléments à compléter : {membership.correction_reason}</p>
            )}
            {!active && (
              <p>
                La demande de prêt sera accessible après activation du compte
                par l’administrateur.
              </p>
            )}
            {!active && (editable ? (
              <button
                className="btn btn-primary"
                onClick={() => window.dispatchEvent(new Event(OPEN_SAVINGS))}
              >
                {membership
                  ? "Corriger ma fiche"
                  : "Ouvrir / reprendre ma fiche d’adhésion"}
              </button>
            ) : (
              <p>
                Votre fiche a été transmise. Vous pouvez actualiser son statut
                ici.
              </p>
            ))}
            {membership && (
              <details>
                <summary>Consulter ma fiche d’adhésion</summary>
                <dl className="savings-review-values">
                  {Object.entries(membership.fields).map(([key, value]) => (
                    <div key={key}>
                      <dt>
                        {membershipFieldLabels[key] ?? key.replaceAll("_", " ")}
                      </dt>
                      <dd>{value || "—"}</dd>
                    </div>
                  ))}
                </dl>
                <h3>Pièces reçues</h3>
                <ul>
                  {membership.documents.map((doc) => (
                    <li key={doc.id}>
                      {doc.label} — {doc.filename}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </section>
    </Screen>
  );
}
