import { useId, useState } from 'react';
import type { FinancialAccount } from '@/api/profile';
import type { SavingsTransaction } from '@/api/savings';
import { formatFcfa } from '@/features/workflow/workflow';
import { cashflowByMonth, transactionTypes } from './transactionHistory';

const compact = (value: number) => new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
const shortDate = (value: string) => new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', timeZone: 'UTC' });
type Props = { rows: SavingsTransaction[]; account: FinancialAccount; onOpen: (row: SavingsTransaction) => void };

export function SavingsCashflow({ rows, account, onOpen }: Props) {
  const years = [...new Set(rows.map(row => Number(row.booked_at.slice(0, 4))).filter(Number.isFinite))].sort((a, b) => b - a);
  const [chosen, setChosen] = useState<number | null>(null);
  const [month, setMonth] = useState('');
  const [hovered, setHovered] = useState<number | null>(null);
  const year = chosen ?? years[0] ?? new Date().getFullYear();
  const gradient = useId().replaceAll(':', '');
  const periodRows = rows.filter(row => Number(row.booked_at.slice(0, 4)) === year && (!month || Number(row.booked_at.slice(5, 7)) === Number(month)));
  const posted = periodRows.filter(row => row.status === 'COMPLETED');
  const income = posted.filter(row => row.direction === 'CREDIT').reduce((sum, row) => sum + row.amount, 0);
  const expense = posted.filter(row => row.direction === 'DEBIT').reduce((sum, row) => sum + row.amount, 0);
  const points = posted.filter(row => row.balance_after != null && Number.isFinite(row.balance_after)).sort((a, b) => a.booked_at.localeCompare(b.booked_at) || a.id - b.id);
  const ceiling = Math.max(1, ...points.map(row => row.balance_after!));
  const floor = Math.min(0, ...points.map(row => row.balance_after!));
  const x = (index: number) => points.length === 1 ? 280 : 48 + index / (points.length - 1) * 452;
  const y = (value: number) => 175 - (value - floor) / (ceiling - floor) * 142;
  const line = points.map((row, index) => `${index ? 'L' : 'M'}${x(index)},${y(row.balance_after!)}`).join(' ');
  const months = cashflowByMonth(rows, year).filter((_, index) => !month || index + 1 === Number(month));
  const maxFlow = Math.max(1, ...months.flatMap(item => [item.income, item.expense]));
  const categories = Object.entries(transactionTypes).map(([type, label]) => ({ type, label, total: posted.filter(row => row.type === type).reduce((sum, row) => sum + row.amount, 0) })).filter(item => item.total > 0);
  const total = income + expense;
  const ratio = total ? income / total : 0;
  const recent = [...periodRows].sort((a, b) => b.booked_at.localeCompare(a.booked_at) || b.id - a.id).slice(0, 3);
  const tooltip = hovered == null ? null : points[hovered];

  return <section className="sf-overview" aria-label="Vue d’ensemble de l’épargne">
    <header className="sf-section-heading"><h2>Vue d’ensemble</h2><div className="sf-toolbar">
      <span className="sf-legend"><i /> Entrées <i className="sf-gold" /> Sorties</span>
      <select className="sf-control" aria-label="Année des graphiques" value={year} onChange={event => { setChosen(Number(event.target.value)); setHovered(null); }}>{(years.length ? years : [year]).map(value => <option key={value}>{value}</option>)}</select>
      <select className="sf-control" aria-label="Mois des graphiques" value={month} onChange={event => { setMonth(event.target.value); setHovered(null); }}><option value="">Tous les mois</option>{Array.from({ length: 12 }, (_, index) => <option key={index} value={index + 1}>{new Date(Date.UTC(year, index, 1)).toLocaleDateString('fr-FR', { month: 'long', timeZone: 'UTC' })}</option>)}</select>
    </div></header>
    <div className="sf-analytics-grid"><div className="sf-analytics-main">
      <section className="sf-panel sf-balance-panel"><dl className="sf-metric-stack">
        {[{ name: 'Solde total', value: account.balance, icon: 'fa-wallet', note: 'Solde actuel du compte' }, { name: 'Disponible', value: account.available_balance, icon: 'fa-coins', note: 'Part non immobilisée' }, { name: 'Épargne bloquée', value: account.blocked_balance, icon: 'fa-lock', note: 'Montant immobilisé' }].map((item, index) => <div key={item.name} className={index === 0 ? 'is-emphasized' : ''}><dt><i className={`fas ${item.icon}`} aria-hidden="true" />{item.name}<i className="fas fa-building-columns sf-metric-mark" aria-hidden="true" /></dt><dd>{formatFcfa(item.value)}<small>{item.value == null ? 'Non renseigné' : item.note}</small></dd></div>)}
      </dl><div className="sf-line-chart"><div className="sf-chart-heading"><h3>Évolution du solde</h3><span>FCFA · {year}</span></div>
        {!points.length ? <div className="sf-chart-empty">Aucun solde comptabilisé sur cette période.</div> : <>
          <svg viewBox="0 0 530 215" role="img" aria-label="Évolution du solde après chaque opération comptabilisée">
            <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--cif-primary-400)" stopOpacity=".22" /><stop offset="100%" stopColor="var(--cif-primary-400)" stopOpacity="0" /></linearGradient></defs>
            {Array.from({ length: 5 }, (_, index) => { const value = floor + (ceiling - floor) * index / 4; return <g key={index}><line x1="48" x2="500" y1={y(value)} y2={y(value)} className="sf-chart-gridline" /><text x="38" y={y(value) + 3} textAnchor="end">{compact(value)}</text></g>; })}
            {points.length > 1 && <path d={`${line} L${x(points.length - 1)},175 L${x(0)},175 Z`} fill={`url(#${gradient})`} />}
            <path d={line} className="sf-chart-line" />
            {points.map((row, index) => <g key={row.id}>
              {points.length <= 6 || index % Math.ceil(points.length / 6) === 0 || index === points.length - 1 ? <text x={x(index)} y="199" textAnchor="middle">{shortDate(row.booked_at)}</text> : null}
              <circle cx={x(index)} cy={y(row.balance_after!)} r="4" className="sf-chart-dot" />
              <circle cx={x(index)} cy={y(row.balance_after!)} r="12" fill="transparent" tabIndex={0} role="button" aria-label={`${shortDate(row.booked_at)}, ${formatFcfa(row.balance_after)}. Voir ${row.reference}`} onMouseEnter={() => setHovered(index)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(index)} onBlur={() => setHovered(null)} onClick={() => onOpen(row)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(row); } }}><title>{row.reference} · {formatFcfa(row.balance_after)}</title></circle>
            </g>)}
          </svg><p className="sf-chart-caption" aria-live="polite">{tooltip ? `${shortDate(tooltip.booked_at)} · ${tooltip.reference} · ${formatFcfa(tooltip.balance_after)}` : 'Soldes constatés aux dates des opérations comptabilisées'}</p>
        </>}
      </div></section>
      <section className="sf-panel sf-report"><div className="sf-chart-heading"><h3>Synthèse des mouvements</h3><span><i className="far fa-calendar" aria-hidden="true" /> {month ? new Date(Date.UTC(year, Number(month) - 1, 1)).toLocaleDateString('fr-FR', { month: 'long', timeZone: 'UTC' }) : 'Janvier – décembre'} {year}</span></div>
        <dl className="sf-report-metrics">{[['Entrées', formatFcfa(income)], ['Sorties', formatFcfa(expense)], ['Variation nette', formatFcfa(income - expense)], ['Opérations', String(posted.length)]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        <div className="sf-report-chart" role="list" aria-label="Entrées et sorties par mois">{months.map((item, index) => { const monthIndex = month ? Number(month) - 1 : index; const label = new Date(Date.UTC(year, monthIndex, 1)).toLocaleDateString('fr-FR', { month: 'short', timeZone: 'UTC' }); return <div className="sf-bar-group" role="listitem" tabIndex={0} key={index} aria-label={`${label} : entrées ${formatFcfa(item.income)}, sorties ${formatFcfa(item.expense)}`}><div className="sf-bar-pair"><span style={{ height: `${item.income / maxFlow * 100}%` }} /><span style={{ height: `${item.expense / maxFlow * 100}%` }} /></div><small>{label}</small><span className="sf-bar-tip">{label}<br />Entrées : {formatFcfa(item.income)}<br />Sorties : {formatFcfa(item.expense)}</span></div>; })}</div>
      </section>
    </div><aside className="sf-analytics-side">
      <section className="sf-panel sf-gauge-panel"><h3>Répartition des mouvements</h3><div className="sf-gauge"><svg viewBox="0 0 220 120" role="img" aria-label={`Entrées ${formatFcfa(income)}, sorties ${formatFcfa(expense)}`}><path d="M20 110 A90 90 0 0 1 200 110" className="sf-gauge-track" /><path d="M20 110 A90 90 0 0 1 200 110" pathLength="100" className="sf-gauge-income" strokeDasharray={`${ratio * 100} 100`} />{total > 0 && <path d="M20 110 A90 90 0 0 1 200 110" pathLength="100" className="sf-gauge-expense" strokeDasharray={`${(1 - ratio) * 100} 100`} strokeDashoffset={-ratio * 100} />}</svg><div><span>Total des flux</span><strong>{formatFcfa(total)}</strong></div></div>
        <dl className="sf-gauge-legend"><div><dt><i />Entrées</dt><dd>{compact(income)} FCFA</dd></div><div><dt><i />Sorties</dt><dd>{compact(expense)} FCFA</dd></div></dl>
      </section>
      <section className="sf-panel sf-categories"><h3>Opérations par type</h3><div className="sf-category-bars">{categories.length ? categories.map((item, index) => <div key={item.type}><div className="sf-category-track"><span className={`sf-category-fill tone-${index % 3}`} style={{ height: `${item.total / Math.max(...categories.map(row => row.total)) * 100}%` }} /></div><small>{item.label}</small><span>{compact(item.total)}</span></div>) : <p>Aucun mouvement comptabilisé.</p>}</div></section>
      <section className="sf-panel sf-recent"><h3>Dernières opérations</h3>{recent.length ? recent.map(row => <button key={row.id} onClick={() => onOpen(row)} type="button"><span className={`sf-operation-avatar ${row.direction === 'DEBIT' ? 'is-debit' : ''}`}><i className={`fas fa-arrow-${row.direction === 'CREDIT' ? 'down' : 'up'}`} aria-hidden="true" /></span><span><strong>{row.label}</strong><small>{shortDate(row.booked_at)}</small></span><b>{compact(row.amount)}<small>FCFA</small></b></button>) : <p>Aucune opération.</p>}</section>
    </aside></div>
  </section>;
}
