import { useEffect, useState } from "react";
import {
  fetchClientProfile,
  hasActiveSavingsAccount,
  type ClientProfile,
} from "@/api/profile";
import { type Membership } from "@/api/savings";
import { getSavingsOnboarding, type SavingsOnboarding } from '@/api/savingsOnboarding';
import { Screen } from "@/shared/ui/Screen";
import { PageHeader } from "@/shared/ui/PageHeader";
import { isSavingsAccount } from "./accountPolicy";
import { SavingsAccountOverview } from './SavingsAccountOverview';
import { SavingsRequestStatus } from './SavingsRequestStatus';
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
  const [lookupStatus, setLookupStatus] = useState<SavingsOnboarding['status'] | null>(null);
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const onboarding = await getSavingsOnboarding();
        const next = await fetchClientProfile();
        if (!mounted) return;
        setProfile(next);
        setLookupStatus(onboarding.status);
        const current = hasActiveSavingsAccount(next) ? null : onboarding.application;
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
            {!active && !(membership && !editable) && <h2 className="savings-workspace-status">
              {membership
                  ? `Demande ${membership.reference || `#${membership.id}`} : ${membershipStatusLabel(membership.status)}`
                  : lookupStatus === 'REVIEW_REQUIRED' ? 'Vérification du rattachement nécessaire' : lookupStatus === 'INACTIVE' ? 'Compte existant — contactez votre agence' : 'Préparer l’ouverture de votre compte épargne'}
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
            {!active && editable && (
              <p>
                {lookupStatus === 'INACTIVE' ? 'Votre compte existe déjà. Contactez votre agence pour vérifier sa situation et les démarches nécessaires à son activation.' : membership?.fields.purpose === 'IDENTITY_REVIEW' || lookupStatus === 'REVIEW_REQUIRED' ? 'Votre agence doit confirmer votre identité et le rattachement à un compte existant avant toute ouverture.' : 'La pré-demande en ligne prépare votre accueil. L’ouverture du compte sera finalisée en agence.'}
              </p>
            )}
            {!active && editable && (
              <button
                className="btn btn-primary"
                onClick={() => window.dispatchEvent(new Event(OPEN_SAVINGS))}
              >
                {membership
                  ? "Compléter ma pré-demande"
                  : lookupStatus === 'REVIEW_REQUIRED' || lookupStatus === 'INACTIVE' ? "Consulter les prochaines étapes" : "Commencer ma pré-demande"}
              </button>
            )}
            {membership && !editable && (
              <SavingsRequestStatus
                reference={membership.reference || `#${membership.id}`}
                agencyName={membership.fields.agency_name || 'À confirmer avec votre conseiller'}
                approved={membership.status === 'APPROVED'}
                identityReview={membership.fields.purpose === 'IDENTITY_REVIEW'}
                legalEntity={profile?.client_type === 'LEGAL_ENTITY'}
                facts={[
                  ['Nom', membership.fields.full_name],
                  ['Téléphone', membership.fields.phone],
                  ['Ville', membership.fields.city],
                  ['Compte déclaré', membership.fields.account_number_hint],
                ].filter((row): row is [string, string] => Boolean(row[1])).map(([label, value]) => ({ label, value }))}
                documents={membership.documents}
                actionLabel="Voir le suivi et les pièces à apporter"
                onAction={() => window.dispatchEvent(new Event(OPEN_SAVINGS))}
              />
            )}
          </>
        )}
      </section>
    </Screen>
  );
}
