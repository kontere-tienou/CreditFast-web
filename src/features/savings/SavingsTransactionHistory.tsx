import { useEffect, useId, useRef, useState } from 'react';
import { listSavingsTransactions, type SavingsTransaction } from '@/api/savings';
import { formatFcfa } from '@/features/workflow/workflow';
import { filterTransactions, transactionStatuses, transactionTypes } from './transactionHistory';
import { SavingsCashflow } from './SavingsCashflow';
import type { FinancialAccount } from '@/api/profile';
import { transactionsCsv } from './transactionHistory';

const dateLabel = (value: string) => new Date(value).toLocaleDateString('fr-FR', { timeZone: 'UTC' });
const amountLabel = (row: SavingsTransaction) => `${row.direction === 'CREDIT' ? '+' : '−'} ${formatFcfa(row.amount)}`;

export function SavingsTransactionHistory({ account, holder }: { account: FinancialAccount; holder: string }) {
  const { id: accountId, account_number: accountNumber } = account;
  const [rows, setRows] = useState<SavingsTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const selectAll = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<SavingsTransaction | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(''); setRows([]);
    if (accountId == null) { setLoading(false); setError('Historique indisponible : compte non identifié.'); return; }
    void listSavingsTransactions(accountId).then(items => { if (!cancelled) setRows(items); })
      .catch(() => { if (!cancelled) setError('Impossible de charger les opérations. Réessayez.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [accountId, attempt]);
  useEffect(() => { setPage(1); setChecked(new Set()); }, [query, from, to, type, pageSize, accountId]);
  useEffect(() => { if (selected) dialog.current?.showModal(); }, [selected]);
  const invalidDates = Boolean(from && to && from > to);
  const filtered = invalidDates ? [] : filterTransactions(rows, query, from, to, type);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const checkedVisible = visible.filter(row => checked.has(row.id)).length;
  useEffect(() => { if (selectAll.current) selectAll.current.indeterminate = checkedVisible > 0 && checkedVisible < visible.length; }, [checkedVisible, visible.length]);
  const pageNumbers = [...new Set([1, currentPage - 1, currentPage, currentPage + 1, pages])].filter(value => value >= 1 && value <= pages).sort((a, b) => a - b);
  const toggle = (id: number) => setChecked(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const exportRows = (items: SavingsTransaction[]) => {
    const url = URL.createObjectURL(new Blob([transactionsCsv(items, accountNumber || '')], { type: 'text/csv;charset=utf-8;' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `operations-epargne-${accountId ?? 'compte'}.csv`; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const initials = holder.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase();
  const reset = () => { setQuery(''); setFrom(''); setTo(''); setType(''); };

  return <>
    {!loading && !error && <SavingsCashflow rows={rows} account={account} onOpen={setSelected} />}
    <section className="sf-transactions" aria-label="Historique des opérations">
    <header className="sf-section-heading"><div><h2>Transactions</h2><p>Vos mouvements · {accountNumber || 'Compte épargne'}</p></div>
      <div className="sf-toolbar">
        <button type="button" className="sf-control sf-icon-button" aria-label="Actualiser les opérations" disabled={loading} onClick={() => setAttempt(value => value + 1)}><i className="fas fa-rotate" aria-hidden="true" /></button>
        <button type="button" className="sf-control" aria-expanded={filtersOpen} aria-controls={`${titleId}-filters`} onClick={() => setFiltersOpen(value => !value)}><i className="fas fa-filter" aria-hidden="true" /> Filtres{(query || from || to || type) ? ' •' : ''}</button>
        <button type="button" className="sf-control sf-export-button" disabled={loading || Boolean(error) || !filtered.length} onClick={() => exportRows(checked.size ? filtered.filter(row => checked.has(row.id)) : filtered)}><i className="fas fa-download" aria-hidden="true" /> Exporter{checked.size ? ` (${filtered.filter(row => checked.has(row.id)).length})` : ''}</button>
      </div>
    </header>
    <div className="savings-history-filters sf-filters" id={`${titleId}-filters`} hidden={!filtersOpen}>
      <label>Rechercher<input className="form-control" type="search" placeholder="Référence ou libellé" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <label>Du<input className="form-control" type="date" value={from} onChange={event => setFrom(event.target.value)} /></label>
      <label>Au<input className="form-control" type="date" value={to} onChange={event => setTo(event.target.value)} /></label>
      <label>Type<select className="form-control" value={type} onChange={event => setType(event.target.value)}><option value="">Toutes les opérations</option>{Object.entries(transactionTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div>
    {invalidDates && <p role="alert" className="savings-error">La date de fin doit être postérieure ou égale à la date de début.</p>}
    {loading ? <p role="status">Chargement des opérations…</p> : error ? <p role="alert" className="savings-error">{error}</p> : <>
      <div className="savings-history-table-wrap"><table className="sf-transaction-table">
        <caption className="sr-only">Opérations du compte {accountNumber}</caption>
        <thead><tr><th scope="col"><input type="checkbox" ref={selectAll} aria-label="Sélectionner les opérations de cette page" checked={visible.length > 0 && checkedVisible === visible.length} disabled={!visible.length} onChange={event => { const all = event.target.checked; setChecked(previous => { const next = new Set(previous); visible.forEach(row => { if (all) next.add(row.id); else next.delete(row.id); }); return next; }); }} /></th>{['Compte', 'Référence', 'Type de paiement', 'Date', 'Montant', 'Statut', 'Actions'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{visible.map(row => <tr key={row.id} className={checked.has(row.id) ? 'is-selected' : ''}>
          <td><input type="checkbox" aria-label={`Sélectionner ${row.reference}`} checked={checked.has(row.id)} onChange={() => toggle(row.id)} /></td>
          <td><div className="sf-account-cell"><span className={`sf-account-avatar tone-${row.id % 3}`} aria-hidden="true">{initials}</span><span><strong>{holder}</strong><small>{accountNumber}</small></span></div></td>
          <td>{row.reference}</td><td><strong>{transactionTypes[row.type]}</strong><small>{row.label}</small></td><td>{dateLabel(row.booked_at)}</td>
          <td className={row.direction === 'CREDIT' ? 'savings-amount-credit' : 'savings-amount-debit'}>{amountLabel(row)}</td>
          <td><span className={`sf-status is-${row.status.toLowerCase()}`}><i />{transactionStatuses[row.status]}</span></td>
          <td><div className="sf-row-actions"><button type="button" aria-label={`Exporter l’opération ${row.reference}`} onClick={() => exportRows([row])}><i className="fas fa-download" aria-hidden="true" /></button><button type="button" aria-label={`Voir l’opération ${row.reference}`} onClick={() => setSelected(row)}><i className="far fa-eye" aria-hidden="true" /></button></div></td>
        </tr>)}</tbody>
      </table></div>
      {!filtered.length && !invalidDates && <p>{rows.length ? 'Aucune opération ne correspond aux filtres.' : 'Aucune opération enregistrée sur ce compte.'}</p>}
      <div className="sf-table-footer"><span>Affichage <strong>{filtered.length ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, filtered.length)}</strong> sur <strong>{filtered.length}</strong> opérations</span>
        {(query || from || to || type) && <button type="button" className="btn btn-secondary" onClick={reset}>Effacer les filtres</button>}
        <nav className="sf-pagination" aria-label="Pagination des opérations"><select className="sf-control" value={pageSize} aria-label="Opérations par page" onChange={event => setPageSize(Number(event.target.value))}>{[5, 10, 20].map(value => <option key={value} value={value}>{value} / page</option>)}</select><button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} aria-label="Page précédente"><i className="fas fa-chevron-left" aria-hidden="true" /> Précédent</button>{pageNumbers.map((value, index) => <span key={value}>{index > 0 && value > pageNumbers[index - 1] + 1 && <span className="sf-page-gap">…</span>}<button type="button" aria-label={`Page ${value}`} aria-current={value === currentPage ? 'page' : undefined} onClick={() => setPage(value)}>{value}</button></span>)}<button type="button" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)} aria-label="Page suivante">Suivant <i className="fas fa-chevron-right" aria-hidden="true" /></button></nav>
      </div>
    </>}
    <dialog ref={dialog} className="savings-transaction-drawer" aria-labelledby={titleId} onClose={() => setSelected(null)} onClick={event => { if (event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.current?.close(); } }}>
      {selected && <><header className="savings-account-details-header"><h3 id={titleId}>Détail de l’opération</h3><button type="button" className="btn btn-secondary" onClick={() => dialog.current?.close()}>Fermer</button></header>
        <p className="savings-transaction-amount">{amountLabel(selected)}</p>
        <dl className="savings-account-details-grid">
          {[['Référence', selected.reference], ['Compte', accountNumber || 'Non renseigné'], ['Libellé', selected.label], ['Date', dateLabel(selected.booked_at)], ['Type', transactionTypes[selected.type]], ['Statut', transactionStatuses[selected.status]], ['Canal', selected.channel || 'Non renseigné'], ['Solde après opération', selected.status === 'COMPLETED' ? formatFcfa(selected.balance_after) : 'Non comptabilisée']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>
        {selected.status !== 'COMPLETED' && <p>Cette opération n’est pas incluse dans le solde comptabilisé.</p>}
      </>}
    </dialog>
  </section></>;
}
