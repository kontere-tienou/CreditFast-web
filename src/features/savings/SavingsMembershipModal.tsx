import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createMembership, getMembership, type Membership } from '@/api/savings';
import { fetchClientProfile, hasActiveSavingsAccount, type ClientProfile } from '@/api/profile';
import { callApp } from '@/shared/ui/legacy';
import { commonSection, closingSection, physicalSections, legalSections, signatorySection, physicalDocuments, legalDocuments, validateMembership, type MembershipSection } from './membershipFields';
import './savings.css';

export const OPEN_SAVINGS_MEMBERSHIP = 'creditfast:open-savings-membership';

function Section({ section }: { section: MembershipSection }) {
  return <fieldset className="savings-section"><legend>{section.title}</legend><div className="savings-grid">{section.fields.map(field => <label key={field.key}>
    {field.label}{field.required ? ' *' : ''}
    {field.options ? <select className="form-control" name={field.key} required={field.required} defaultValue=""><option value="">Sélectionner</option>{field.options.map(value => <option key={value}>{value}</option>)}</select>
      : <input className="form-control" name={field.key} type={field.type ?? 'text'} required={field.required} min={field.type === 'number' ? 0 : undefined} step={field.type === 'number' ? 'any' : undefined} maxLength={2000} />}
  </label>)}</div></fieldset>;
}

export function SavingsMembershipModal() {
  const dialog = useRef<HTMLDialogElement>(null);
  const generation = useRef(0);
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [type, setType] = useState('PHYSICAL_PERSON');
  const [signatories, setSignatories] = useState(1);
  const legal = type === 'LEGAL_ENTITY';

  async function refresh() {
    const version = ++generation.current;
    setLoading(true); setError(''); setLoaded(false);
    try {
      const next = await fetchClientProfile();
      if (version !== generation.current) return;
      setProfile(next);
      if (hasActiveSavingsAccount(next)) {
        dialog.current?.close();
        callApp('openNewLoanModal');
        return;
      }
      const current = await getMembership();
      if (version !== generation.current) return;
      setMembership(current);
      setType(next?.client_type === 'LEGAL_ENTITY' ? 'LEGAL_ENTITY' : 'PHYSICAL_PERSON');
      setLoaded(true);
    } catch (cause) {
      if (version === generation.current) setError(cause instanceof Error ? cause.message : 'Vérification impossible. Réessayez.');
    } finally { if (version === generation.current) setLoading(false); }
  }

  useEffect(() => {
    const open = () => { dialog.current?.showModal(); void refresh(); };
    window.addEventListener(OPEN_SAVINGS_MEMBERSHIP, open);
    return () => { generation.current++; window.removeEventListener(OPEN_SAVINGS_MEMBERSHIP, open); };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const fields = Object.fromEntries([...data.entries()].filter((entry): entry is [string, string] => typeof entry[1] === 'string').map(([key, value]) => [key, value.trim()]));
    const invalid = validateMembership(fields, data, legal);
    if (invalid) { setError(invalid); return; }
    const body = new FormData();
    body.set('client_type', type);
    body.set('fields', JSON.stringify({ ...fields, signatory_count: legal ? String(signatories) : '0' }));
    for (const [key, file] of data.entries()) {
      if (!(file instanceof File) || !file.size) continue;
      if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type) || file.size > 10 * 1024 * 1024) {
        setError('Chaque pièce doit être un PDF, JPG ou PNG de 10 Mo maximum.'); return;
      }
      body.append(`documents[${key}]`, file);
    }
    setBusy(true); setError('');
    try { setMembership(await createMembership(body)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Enregistrement impossible.'); }
    finally { setBusy(false); }
  }

  const waiting = membership?.status === 'PENDING' || membership?.status === 'APPROVED';
  return <dialog ref={dialog} className="savings-dialog" aria-labelledby="savings-title" onCancel={event => { if (busy) event.preventDefault(); }} onClose={() => { generation.current++; setLoaded(false); setMembership(null); setError(''); }}>
    <header className="savings-header"><div><h2 id="savings-title">Ouvrir un compte épargne</h2><p>Fiche d’adhésion à KAFO JIGINEW</p></div><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => dialog.current?.close()} aria-label="Fermer">Fermer</button></header>
    <div className="savings-content">
      <p>Une demande de prêt nécessite un compte épargne actif. Votre adhésion restera en attente jusqu’à sa validation par l’administrateur. Le numéro de compte sera attribué à la validation.</p>
      {error && <p role="alert" className="savings-error">{error}</p>}
      {loading && <p role="status">Vérification du compte épargne…</p>}
      {!loading && !loaded && <button type="button" className="btn btn-primary" onClick={() => void refresh()}>Réessayer</button>}
      {loaded && waiting && <div role="status"><h3>{membership.status === 'PENDING' ? 'Adhésion en attente de validation' : 'Adhésion validée — activation du compte en cours'}</h3><p>Vous pourrez faire votre demande de prêt dès que votre compte épargne sera actif.</p><button className="btn btn-primary" type="button" onClick={() => void refresh()}>Actualiser le statut</button></div>}
      {loaded && !waiting && <form onSubmit={submit}>
        {membership?.status === 'REJECTED' && <p role="status">Adhésion refusée : {membership.rejection_reason || 'Contactez votre chargé de crédit.'} Vous pouvez soumettre une nouvelle fiche.</p>}
        <fieldset disabled={busy} className="savings-form-body">
          <label>Type de demandeur<select className="form-control" value={type} disabled={['PHYSICAL_PERSON', 'LEGAL_ENTITY'].includes(profile?.client_type ?? '')} onChange={event => setType(event.target.value)}><option value="PHYSICAL_PERSON">Personne physique</option><option value="LEGAL_ENTITY">Personne morale</option></select></label>
          <Section section={commonSection} />
          <div key={type}>
            {legal ? <><Section section={legalSections[0]} /><label>Nombre de signataires<select className="form-control" value={signatories} onChange={event => setSignatories(Number(event.target.value))}>{[1, 2, 3].map(n => <option key={n} value={n}>{n}</option>)}</select></label>{Array.from({ length: signatories }, (_, i) => <Section key={i} section={signatorySection(i + 1)} />)}{legalSections.slice(1).map(section => <Section key={section.title} section={section} />)}</> : physicalSections.map(section => <Section key={section.title} section={section} />)}
            <p>La classification du risque est réservée à l’administrateur.</p>
            <fieldset className="savings-section"><legend>6. Pièces fournies</legend><p>Copies certifiées lorsque demandées. PDF, JPG ou PNG, 10 Mo maximum par fichier. Les pièces sélectionnées seront transmises avec la fiche.</p><div className="savings-grid">
              {(legal ? legalDocuments : physicalDocuments).map(([key, label, required]) => <label key={key}>{label}{required ? ' *' : ''}<input type="file" name={key} required={required} accept=".pdf,.jpg,.jpeg,.png" /></label>)}
              {legal && Array.from({ length: signatories }, (_, i) => ['photo', 'signature'].map(kind => <label key={`${i}-${kind}`}>{kind === 'photo' ? 'Photo' : 'Signature'} du signataire {i + 1} *<input type="file" name={`signatory_${i + 1}_${kind}`} required accept=".pdf,.jpg,.jpeg,.png" /></label>))}
            </div></fieldset>
            <Section section={closingSection} />
            <label><input type="checkbox" required /> Je certifie l’exactitude des informations et demande l’ouverture d’un compte épargne.</label>
          </div>
          <p>* Champ obligatoire. La signature de la caisse sera renseignée lors de la validation.</p>
          <button className="btn btn-primary" type="submit">{busy ? 'Envoi en cours…' : 'Soumettre mon adhésion'}</button>
        </fieldset>
      </form>}
    </div>
  </dialog>;
}
