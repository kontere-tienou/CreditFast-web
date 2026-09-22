import { useEffect, useState, type FormEvent } from 'react';
import { apiJson } from '@/api/client';
import { unwrapCollection } from '@/api/admin';
import { Screen } from '@/shared/ui/Screen';
import { PageHeader } from '@/shared/ui/PageHeader';
import { AdminSavingsMemberships } from './AdminSavingsMemberships';

type PendingAccount = { id: number; account_number: string; client_name: string; account_type: string };
export function AdminSavingsPage() {
  const [accounts, setAccounts] = useState<PendingAccount[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  async function load() {
    setBusy(true); setError('');
    try { setAccounts(unwrapCollection<PendingAccount>(await apiJson('/admin/financial-accounts?status=PENDING'))); }
    catch { setError('La liste des comptes saisis par les agents est indisponible.'); }
    finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, []);
  async function review(event: FormEvent<HTMLFormElement>, account: PendingAccount) {
    event.preventDefault(); if (busy) return;
    const data = new FormData(event.currentTarget);
    const decision = String(data.get('decision'));
    const reason = String(data.get('reason') ?? '').trim();
    if (decision === 'REJECTED' && !reason) { setError('Indiquez le motif du refus.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      await apiJson(`/admin/financial-accounts/${account.id}/review`, { method: 'POST', body: JSON.stringify({ decision, rejection_reason: reason || undefined }) });
      setAccounts(current => current.filter(row => row.id !== account.id));
      setNotice(decision === 'APPROVED' ? 'Compte validé et activé.' : 'Compte refusé.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Décision non enregistrée.'); }
    finally { setBusy(false); }
  }
  return <Screen viewId="view-admin-savings"><PageHeader title="Comptes épargne et adhésions" crumbs={['Administration', 'Épargne']} /><AdminSavingsMemberships />
    <section className="savings-admin"><h2>Comptes saisis par les agents</h2><p>Ces comptes restent en attente jusqu’à votre décision.</p><button className="btn btn-secondary" disabled={busy} onClick={() => void load()}>Actualiser</button>
      {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}{busy && <p role="status">Chargement / enregistrement…</p>}
      {!busy && !error && accounts.length === 0 && <p>Aucun compte en attente.</p>}
      {accounts.map(account => <details key={account.id}><summary>{account.client_name} — {account.account_number} — {account.account_type}</summary><form onSubmit={event => void review(event, account)}><fieldset disabled={busy} className="savings-section"><label>Décision<select name="decision" className="form-control"><option value="APPROVED">Valider et activer</option><option value="REJECTED">Refuser</option></select></label><label>Motif du refus<textarea name="reason" className="form-control" maxLength={2000} /></label><label><input type="checkbox" required /> J’ai vérifié le compte et confirme ma décision.</label><button className="btn btn-primary">Enregistrer</button></fieldset></form></details>)}
    </section></Screen>;
}
