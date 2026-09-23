import { useEffect, useRef, useState, type FormEvent } from 'react';
import { getSavingsOnboarding, submitSavingsPreApplication, type SavingsOnboarding } from '@/api/savingsOnboarding';
import { fetchClientProfile, type ClientProfile } from '@/api/profile';
import { getUiSession } from '@/app/session';
import { SavingsRequestStatus } from './SavingsRequestStatus';
import { OPEN_SAVINGS, SAVINGS_CHANGED } from './workflow';
import './savings.css';

export function SavingsOnboardingModal() {
  const dialog = useRef<HTMLDialogElement>(null);
  const generation = useRef(0);
  const [data, setData] = useState<SavingsOnboarding | null>(null);
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [step, setStep] = useState<'welcome' | 'form' | 'agencies'>('welcome');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [existing, setExisting] = useState(false);
  const [agency, setAgency] = useState('');
  async function load() {
    const version = ++generation.current;
    setLoading(true); setError(''); setData(null);
    try {
      const next = await getSavingsOnboarding();
      const nextProfile = await fetchClientProfile();
      if (version !== generation.current) return;
      setData(next); setProfile(nextProfile);
      setAgency(next.application?.fields.agency_code || '');
      setExisting(next.status === 'REVIEW_REQUIRED' || next.application?.fields.purpose === 'IDENTITY_REVIEW');
    } catch { if (version === generation.current) setError('La vérification n’a pas abouti. Réessayez avant de commencer une demande.'); }
    finally { if (version === generation.current) setLoading(false); }
  }
  useEffect(() => {
    const open = () => {
      if (getUiSession()?.role !== 'CLIENT') return;
      setStep('welcome'); dialog.current?.showModal(); void load();
    };
    window.addEventListener(OPEN_SAVINGS, open);
    return () => { generation.current++; window.removeEventListener(OPEN_SAVINGS, open); };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || !data) return;
    const body = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    body.existing_account = existing ? 'yes' : 'no';
    const version = generation.current;
    setBusy(true); setError('');
    try {
      const application = await submitSavingsPreApplication(body);
      if (generation.current !== version) return;
      setData({ ...data, application }); setStep('welcome');
      window.dispatchEvent(new Event(SAVINGS_CHANGED));
    } catch (cause) { if (generation.current === version) setError(cause instanceof Error ? cause.message : 'Enregistrement impossible.'); }
    finally { setBusy(false); }
  }
  const name = profile?.user?.first_name || profile?.user?.full_name || getUiSession()?.name || '';
  const application = data?.application;
  const waiting = application && ['PENDING', 'APPROVED'].includes(application.status);
  const linked = data?.status === 'MATCHED' || data?.status === 'INACTIVE';
  return <dialog ref={dialog} className="savings-dialog savings-onboarding-dialog" aria-labelledby="savings-onboarding-title" onCancel={event => { if (busy) event.preventDefault(); }} onClose={() => { generation.current++; setData(null); }}>
    <header className="savings-header"><div><h2 id="savings-onboarding-title">{waiting ? 'Suivi de votre demande' : `Bienvenue${name ? `, ${name}` : ''}`}</h2><p>Votre compte épargne</p></div><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => dialog.current?.close()}>Fermer</button></header>
    <div className="savings-content">
      {loading && <p role="status">Recherche de votre compte épargne…</p>}
      {error && <p role="alert" className="savings-error">{error}</p>}
      {!loading && !data && <button className="btn btn-primary" onClick={() => void load()}>Réessayer</button>}
      {!loading && data && <>
        {linked ? <><h3>{data.status === 'MATCHED' ? 'Votre compte est rattaché à votre profil' : 'Votre compte existe, mais n’est pas actif'}</h3><p>{data.status === 'MATCHED' ? 'Vous pouvez consulter votre épargne et poursuivre votre parcours depuis votre espace.' : 'Contactez votre agence pour vérifier son statut. Une nouvelle ouverture n’est pas nécessaire.'}</p></> : waiting ? (
          <SavingsRequestStatus
            reference={application.reference || `#${application.id}`}
            agencyName={application.fields.agency_name || 'À confirmer avec votre conseiller'}
            approved={application.status === 'APPROVED'}
            identityReview={application.fields.purpose === 'IDENTITY_REVIEW'}
            legalEntity={profile?.client_type === 'LEGAL_ENTITY'}
            actionLabel="Vérifier le suivi"
            onAction={() => void load()}
          />
        ) : <>
          {step === 'welcome' && <>
            <h3>{data.status === 'NOT_FOUND' ? 'Aucun compte épargne rattaché à votre profil' : 'Votre rattachement doit être vérifié'}</h3>
            <p>{data.status === 'NOT_FOUND' ? 'Vous devez disposer d’un compte épargne actif pour demander un prêt. Commencez votre demande en ligne, puis rendez-vous dans une agence pour finaliser l’ouverture.' : 'Les informations disponibles ne permettent pas de confirmer un compte de façon unique. Une vérification en agence est nécessaire avant toute ouverture.'}</p>
            {application?.correction_reason && <p className="savings-error">À compléter : {application.correction_reason}</p>}
            <div className="savings-onboarding-actions">
              <button type="button" className="btn btn-primary" onClick={() => { if (data.status === 'NOT_FOUND') { setExisting(false); setStep('agencies'); } else setStep('form'); }}>{data.status === 'NOT_FOUND' ? 'Commencer ma demande' : 'Demander une vérification'}</button>
              {data.status === 'NOT_FOUND' && <button type="button" className="btn btn-secondary" onClick={() => { setExisting(true); setStep('form'); }}>J’ai déjà un compte épargne</button>}
            </div>
          </>}
          {step === 'agencies' && <><h3>Choisir une agence</h3><div className="savings-grid">{data.agencies.map(item => <article className="savings-section" key={item.code}><h4>{item.city} — {item.name}</h4><p>{item.address}</p><button type="button" className="btn btn-secondary" onClick={() => { setExisting(false); setAgency(item.code); setStep('form'); }}>Choisir cette agence</button></article>)}</div><button type="button" className="btn btn-secondary" onClick={() => setStep('welcome')}>Retour</button></>}
          {step === 'form' && <form onSubmit={submit}><h3>{existing ? 'Préparer la vérification en agence' : 'Commencer l’ouverture du compte'}</h3><p>Ces premières informations permettent de préparer votre accueil. L’agence vérifiera votre identité et finalisera la procédure.</p><fieldset disabled={busy} className="savings-form-body"><div className="savings-grid">
            <label>{profile?.client_type === 'LEGAL_ENTITY' ? 'Raison sociale' : 'Nom complet'} *<input className="form-control" name="full_name" required maxLength={200} defaultValue={application?.fields.full_name || profile?.company_name || profile?.user?.full_name || [profile?.user?.first_name, profile?.user?.last_name].filter(Boolean).join(' ')} /></label>
            <label>Téléphone *<input className="form-control" name="phone" type="tel" required maxLength={30} defaultValue={application?.fields.phone || profile?.user?.phone || getUiSession()?.phone || ''} /></label>
            <label>Ville de résidence *<input className="form-control" name="city" required maxLength={100} defaultValue={application?.fields.city || profile?.city || ''} /></label>
            <label>Agence souhaitée *<select name="agency_code" className="form-control" required value={agency} onChange={event => setAgency(event.target.value)}><option value="">Choisir une agence</option>{data.agencies.map(item => <option key={item.code} value={item.code}>{item.city} — {item.name}</option>)}</select></label>
            {existing && <label>Numéro de compte connu (facultatif)<input className="form-control" name="account_number_hint" maxLength={100} defaultValue={application?.fields.account_number_hint || ''} /></label>}
          </div><div className="savings-onboarding-actions"><button type="button" className="btn btn-secondary" onClick={() => setStep(existing ? 'welcome' : 'agencies')}>Retour</button><button className="btn btn-primary" type="submit">{busy ? 'Enregistrement…' : 'Soumettre ma pré-demande'}</button></div></fieldset></form>}
        </>}
      </>}
    </div>
  </dialog>;
}
