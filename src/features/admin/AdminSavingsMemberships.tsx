import { useEffect, useState, type FormEvent } from 'react';
import { listPendingMemberships, membershipDocument, reviewMembership, type Membership } from '@/api/savings';
import { isApiError } from '@/api/errors';
import { commonSection, closingSection, physicalSections, legalSections, signatorySection } from '@/features/savings/membershipFields';
import '@/features/savings/savings.css';

const labels = Object.fromEntries([commonSection, closingSection, ...physicalSections, ...legalSections, ...[1, 2, 3].map(signatorySection)].flatMap(section => section.fields.map(field => [field.key, field.label])));

export function AdminSavingsMemberships() {
  const [rows, setRows] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState<number | null>(null);

  async function load() {
    setLoading(true); setError('');
    try { setRows(await listPendingMemberships()); }
    catch (cause) { setError(isApiError(cause) && [404, 405, 501].includes(cause.status) ? 'Le service de validation des adhésions épargne n’est pas encore disponible sur le serveur.' : 'Impossible de charger les adhésions. Réessayez.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function download(row: Membership, id: number, filename: string) {
    try {
      const { blob } = await membershipDocument(row.id, id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = filename;
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError('Impossible de télécharger cette pièce justificative.'); }
  }

  async function review(event: FormEvent<HTMLFormElement>, row: Membership) {
    event.preventDefault();
    if (busy !== null) return;
    const data = new FormData(event.currentTarget);
    const decision = data.get('decision') === 'REJECTED' ? 'REJECTED' : 'APPROVED';
    const value = (key: string) => String(data.get(key) ?? '').trim();
    if (decision === 'APPROVED' && (!value('account_number') || !value('risk_level') || !value('caisse_signature'))) { setError('Renseignez le numéro de compte, le risque et la signature de la caisse avant de valider.'); return; }
    if (decision === 'REJECTED' && !value('rejection_reason')) { setError('Indiquez le motif du refus.'); return; }
    setBusy(row.id); setError(''); setNotice('');
    try {
      await reviewMembership(row.id, { decision, ...(decision === 'APPROVED' ? { account_number: value('account_number'), risk_level: value('risk_level'), caisse_signature: value('caisse_signature') } : { rejection_reason: value('rejection_reason') }) });
      setRows(current => current.filter(item => item.id !== row.id));
      setNotice(decision === 'APPROVED' ? 'Adhésion validée. Le compte épargne est actif.' : 'Adhésion refusée. Le demandeur pourra corriger sa fiche.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Validation impossible.'); }
    finally { setBusy(null); }
  }

  return <section className="savings-admin" aria-labelledby="admin-savings-title">
    <h2 id="admin-savings-title">Adhésions épargne à valider</h2>
    <p>Examinez la fiche et les pièces justificatives avant d’activer le compte épargne.</p>
    <button className="btn btn-secondary" type="button" disabled={loading || busy !== null} onClick={() => void load()}>Actualiser</button>
    {loading && <p role="status">Chargement des adhésions…</p>}
    {error && <p role="alert" className="savings-error">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {!loading && !error && rows.length === 0 && <p>Aucune adhésion en attente.</p>}
    {rows.map(row => <details key={row.id}>
      <summary>{row.applicant_name} — {row.client_type === 'LEGAL_ENTITY' ? 'Personne morale' : 'Personne physique'} — En attente</summary>
      <dl className="savings-review-values">{Object.entries(row.fields).map(([key, value]) => <div key={key}><dt>{labels[key] ?? (key === 'signatory_count' ? 'Nombre de signataires' : key)}</dt><dd>{value || '—'}</dd></div>)}</dl>
      <h3>Pièces fournies</h3>
      <ul>{row.documents.map(doc => <li key={doc.id}><button className="btn btn-secondary" type="button" onClick={() => void download(row, doc.id, doc.filename)}>{doc.label} — {doc.filename}</button></li>)}</ul>
      <form onSubmit={event => void review(event, row)}><fieldset disabled={busy !== null} className="savings-section"><legend>Décision de l’administrateur</legend><div className="savings-grid">
        <label>Décision<select className="form-control" name="decision"><option value="APPROVED">Valider et activer le compte</option><option value="REJECTED">Refuser l’adhésion</option></select></label>
        <label>N° de compte épargne<input className="form-control" name="account_number" maxLength={100} /></label>
        <label>Profil de risque<select className="form-control" name="risk_level" defaultValue=""><option value="">Sélectionner</option><option value="LOW">Faible</option><option value="MEDIUM">Moyen</option><option value="HIGH">Élevé</option></select></label>
        <label>Signature caisse (nom du responsable)<input className="form-control" name="caisse_signature" maxLength={200} /></label>
        <label>Motif du refus<textarea className="form-control" name="rejection_reason" maxLength={2000} /></label>
      </div><label><input type="checkbox" required /> J’ai vérifié la fiche et ses pièces justificatives et confirme cette décision.</label><p><button className="btn btn-primary" type="submit">{busy === row.id ? 'Enregistrement…' : 'Enregistrer la décision'}</button></p></fieldset></form>
    </details>)}
  </section>;
}
