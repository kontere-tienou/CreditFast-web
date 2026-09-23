import { useEffect, useState } from 'react';
import { apiJson } from '@/api/client';
import { LOCAL_WORKFLOW } from '@/app/runtimeMode';

type Assignment = { id: number; agency_code: string; agency_name?: string; assigned_agent_name?: string; assignment_reason?: string; assignment_status: string; assignment_history?: { at: string; actor_id: number; from_agent_id?: number; to_agent_id: number; reason: string }[] };
type Agent = { id: number; full_name: string; agency_code: string; available: boolean; status: string; zone_codes: string[] };
type Zone = { code: string; name: string; agency_code: string };
export function AssignmentQueue() {
  const [rows, setRows] = useState<Assignment[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [agency, setAgency] = useState('');
  async function load() {
    setError('');
    try {
      const [list, catalog] = await Promise.all([apiJson<{ data: Assignment[] }>('/routing/requests'), apiJson<{ agents: Agent[]; zones: Zone[] }>('/routing/catalog')]);
      setRows(list.data); setAgents(catalog.agents); setZones(catalog.zones);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Chargement impossible.'); }
  }
  useEffect(() => { if (LOCAL_WORKFLOW) void load(); }, []);
  if (!LOCAL_WORKFLOW) return null;
  return <section className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
    <h3>Affectation des dossiers</h3><p>Attribuez les dossiers en attente ou réaffectez leur agent au sein de l’agence responsable.</p>
    <div className="page-actions"><label>Agence<select className="form-control" value={agency} onChange={event => setAgency(event.target.value)}><option value="">Toutes les agences</option>{[...new Set(rows.map(row => row.agency_code))].filter(Boolean).map(code => <option key={code}>{code}</option>)}</select></label><button className="btn btn-secondary" disabled={busy} onClick={() => void load()}>Actualiser les affectations</button></div>
    {error && <p role="alert">{error}</p>}
    <details><summary>Couverture et disponibilité des agents</summary>{agents.map(agent => <form key={`${agent.id}-${agent.agency_code}-${agent.available}-${agent.zone_codes.join(',')}`} onSubmit={async event => {
      event.preventDefault(); const data = new FormData(event.currentTarget); setBusy(true); setError('');
      try { await apiJson(`/routing/agents/${agent.id}`, { method: 'PUT', body: JSON.stringify({ agency_code: agent.agency_code, available: data.has('available'), zone_codes: data.getAll('zone_codes') }) }); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Modification impossible.'); } finally { setBusy(false); }
    }}><fieldset disabled={busy}><legend>{agent.full_name} — {agent.agency_code}</legend><label><input type="checkbox" name="available" defaultChecked={agent.available} /> Disponible pour de nouveaux dossiers</label>{zones.filter(zone => zone.agency_code === agent.agency_code).map(zone => <label key={zone.code} style={{ display: 'block' }}><input type="checkbox" name="zone_codes" value={zone.code} defaultChecked={agent.zone_codes.includes(zone.code)} /> {zone.name}</label>)}<button className="btn btn-secondary" type="submit">Enregistrer la couverture</button></fieldset></form>)}</details>
    {!rows.length && <p>Aucun dossier soumis.</p>}
    {rows.filter(row => !agency || row.agency_code === agency).map(row => <details key={row.id} style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--border-color, #ddd)' }}>
      <summary>Dossier #{row.id} · {row.agency_name || row.agency_code || 'Agence à confirmer'} · {row.assignment_status === 'ASSIGNED' ? row.assigned_agent_name : 'À affecter'}</summary>
      {row.assignment_reason && <p>{row.assignment_reason}</p>}
      <form onSubmit={async event => {
        event.preventDefault(); const fields = Object.fromEntries(new FormData(event.currentTarget)); setBusy(true); setError('');
        try { await apiJson(`/routing/requests/${row.id}/assign`, { method: 'POST', body: JSON.stringify(fields) }); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Affectation impossible.'); } finally { setBusy(false); }
      }}><fieldset disabled={busy}><label>Agent<select className="form-control" name="agent_id" required defaultValue=""><option value="">Choisir un agent</option>{agents.filter(agent => agent.agency_code === row.agency_code && agent.available && agent.status === 'active').map(agent => <option key={agent.id} value={agent.id}>{agent.full_name}</option>)}</select></label><label>Motif<input className="form-control" name="reason" required maxLength={500} /></label><button className="btn btn-primary" type="submit">Enregistrer l’affectation</button></fieldset></form>
      <ul>{row.assignment_history?.map((entry, i) => <li key={i}>{new Date(entry.at).toLocaleString('fr-FR')} · {entry.reason} · Agent {entry.from_agent_id || '—'} → {entry.to_agent_id} · Auteur {entry.actor_id}</li>)}</ul>
    </details>)}
  </section>;
}
