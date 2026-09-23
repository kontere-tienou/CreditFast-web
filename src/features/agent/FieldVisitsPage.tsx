import { useEffect, useRef, useState, type FormEvent } from 'react';
import { getUiSession } from '@/app/session';
import { Screen } from '@/shared/ui/Screen';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Button } from '@/shared/ui/Button';
import { CfField } from '@/shared/ui/CfField';
import { useCreditRequests } from '@/features/workflow/useCreditRequests';
import { borrowerName, notifyRequestsChanged } from '@/features/workflow/workflow';
import { cancelFieldVisit, completeFieldVisit, createFieldVisit, getFieldVisit, listFieldVisits, listRequestFieldVisits, startFieldVisit, updateFieldVisit, type FieldVisit, type FieldVisitOutcome, type FieldVisitStatus, type FieldVisitType, type VisitPage } from '@/api/fieldVisits';
import { canPlanVisit, localDateTime, scheduleTimestamp, visitActions, visitCoordinates, visitOutcomes, visitStatuses, visitTypes } from './fieldVisitPolicy';
import './fieldVisits.css';

type Mode = 'view' | 'create' | 'edit' | 'start' | 'complete' | 'cancel';
const dateLabel = (value?: string | null) => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleString('fr-FR') : '—';
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Opération impossible. Réessayez.';

function LocationFields({ visit }: { visit?: FieldVisit | null }) {
  return <>
    <label>Lieu / adresse<input className="form-control" name="location_label" defaultValue={visit?.location_label ?? ''} maxLength={500} /></label>
    <label>Latitude<CfField kind="decimal" name="latitude" defaultValue={visit?.latitude ?? ''} /></label>
    <label>Longitude<CfField kind="decimal" name="longitude" defaultValue={visit?.longitude ?? ''} /></label>
  </>;
}

export function FieldVisitsPage() {
  const admin = getUiSession()?.role === 'ADMIN';
  const requests = useCreditRequests(admin ? 'mine' : 'agent');
  const [status, setStatus] = useState<FieldVisitStatus | ''>('');
  const [requestId, setRequestId] = useState('');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<VisitPage>({ items: [], page: 1, lastPage: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<FieldVisit | null>(null);
  const [mode, setMode] = useState<Mode>('view');
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const detailVersion = useRef(0);
  const detailId = useRef<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let current = true;
    setLoading(true); setError('');
    const load = requestId && !status
      ? listRequestFieldVisits(Number(requestId), page)
      : listFieldVisits({ status: status || undefined, credit_request_id: requestId ? Number(requestId) : undefined, page });
    load.then(next => { if (current) setResult(next); }).catch(cause => { if (current) { setError(errorMessage(cause)); setResult({ items: [], page: 1, lastPage: 1 }); } }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [status, requestId, page, revision]);
  useEffect(() => () => { detailVersion.current++; }, []);

  async function openVisit(id: number) {
    const version = ++detailVersion.current;
    detailId.current = id; setSelected(null); setMode('view'); setDetailError(''); setDetailLoading(true);
    if (!dialog.current?.open) dialog.current?.showModal();
    try { const visit = await getFieldVisit(id); if (detailVersion.current === version) setSelected(visit); }
    catch (cause) { if (detailVersion.current === version) setDetailError(errorMessage(cause)); }
    finally { if (detailVersion.current === version) setDetailLoading(false); }
  }
  function create() {
    detailVersion.current++; detailId.current = null; setSelected(null); setMode('create'); setDetailError(''); setDetailLoading(false);
    dialog.current?.showModal();
  }
  function changeMode(next: Mode) { setMode(next); setDetailError(''); }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const data = new FormData(event.currentTarget);
    const value = (name: string) => String(data.get(name) ?? '').trim();
    lock.current = true; setBusy(true); setDetailError(''); setNotice('');
    try {
      const actions = visitActions(selected?.status);
      if (mode !== 'create' && (!selected || mode === 'view' || !actions[mode])) throw new Error('Cette action n’est plus disponible. Actualisez la visite.');
      if (mode === 'create' || mode === 'edit') {
        const visitType = value('visit_type');
        if (!(visitType in visitTypes)) throw new Error('Choisissez un type de visite.');
        const body = { visit_type: visitType as FieldVisitType, scheduled_at: scheduleTimestamp(value('scheduled_at')), purpose: value('purpose') || null, location_label: value('location_label') || null, ...visitCoordinates(value('latitude'), value('longitude')) };
        if (mode === 'create') {
          const id = Number(value('credit_request_id'));
          if (!requests.items.some(row => row.id === id && canPlanVisit(row.status))) throw new Error('Choisissez un dossier éligible à une visite terrain.');
          await createFieldVisit(id, body);
        } else await updateFieldVisit(selected!.id, body);
      } else if (mode === 'start') await startFieldVisit(selected!.id);
      else if (mode === 'complete') {
        const outcome = value('outcome');
        if (!(outcome in visitOutcomes) || !value('findings')) throw new Error('Renseignez les constats et la conclusion du rapport.');
        await completeFieldVisit(selected!.id, { outcome: outcome as FieldVisitOutcome, findings: value('findings'), recommendations: value('recommendations') || null, location_label: value('location_label') || null, ...visitCoordinates(value('latitude'), value('longitude')) });
      } else if (mode === 'cancel') {
        if (!value('reason')) throw new Error('Indiquez le motif de l’annulation ou de l’absence.');
        await cancelFieldVisit(selected!.id, { reason: value('reason'), as_no_show: data.get('as_no_show') === 'on' });
      }
      const messages: Record<string, string> = { create: 'Visite planifiée.', edit: 'Visite mise à jour.', start: 'Visite démarrée.', complete: 'Rapport de visite enregistré.', cancel: data.get('as_no_show') === 'on' ? 'Absence du client enregistrée.' : 'Visite annulée.' };
      setNotice(messages[mode]); dialog.current?.close(); setPage(1); setRevision(v => v + 1); notifyRequestsChanged();
    } catch (cause) { setDetailError(errorMessage(cause)); }
    finally { lock.current = false; setBusy(false); }
  }

  const actions = visitActions(selected?.status);
  const eligible = requests.items.filter(row => canPlanVisit(row.status));
  const heading = { view: 'Détail de la visite', create: 'Planifier une visite', edit: 'Modifier la visite', start: 'Démarrer la visite', complete: 'Clôturer et enregistrer le rapport', cancel: 'Annuler / signaler une absence' }[mode];
  return <Screen viewId={admin ? 'view-admin-field-visits' : 'view-agent-field-visits'}>
    <PageHeader title="Visites terrain" crumbs={[admin ? 'Administration' : 'Espace agent', 'Planning et rapports']} subtitle="Planifiez les déplacements et conservez les constats de chaque visite." actions={<Button disabled={requests.loading || !!requests.error || !eligible.length} onClick={create}><i className="fas fa-calendar-plus" /> Planifier une visite</Button>} />
    {requests.error && <div role="alert" className="visit-error">Dossiers indisponibles : {requests.error} <Button variant="secondary" onClick={() => void requests.reload()}>Recharger les dossiers</Button></div>}
    {!requests.loading && !requests.error && !eligible.length && <p>Aucun dossier éligible à une nouvelle visite. Les dossiers doivent être soumis, en vérification, en analyse ou en examen approfondi.</p>}
    <div className="visit-panel visit-filters">
      <label>Statut<select className="form-control" value={status} onChange={event => { setStatus(event.target.value as FieldVisitStatus | ''); setPage(1); }}><option value="">Tous les statuts</option>{Object.entries(visitStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>Dossier<select className="form-control" value={requestId} disabled={requests.loading} onChange={event => { setRequestId(event.target.value); setPage(1); }}><option value="">Tous les dossiers</option>{requests.items.map(row => <option key={row.id} value={row.id}>#{row.id} — {borrowerName(row)}</option>)}</select></label>
      <Button variant="secondary" disabled={loading} onClick={() => setRevision(v => v + 1)}>Actualiser</Button>
    </div>
    {notice && <p role="status" className="visit-notice">{notice}</p>}
    {error && <p role="alert" className="visit-error">{error}</p>}
    {loading ? <p role="status">Chargement des visites…</p> : !error && <>
      {result.items.length === 0 && <p>Aucune visite pour ces critères.</p>}
      <div className="visit-list">{result.items.map(visit => <article key={visit.id} className="visit-panel">
        <div className="visit-card-header"><h2>{visit.visit_type ? visitTypes[visit.visit_type] ?? visit.visit_type : 'Visite terrain'} <small>#{visit.id}</small></h2><span className="badge">{visit.status ? visitStatuses[visit.status] ?? visit.status : 'Statut inconnu'}</span></div>
        <p><strong>{dateLabel(visit.scheduled_at)}</strong> · Dossier #{visit.credit_request_id ?? '—'}</p><p>{visit.location_label || 'Lieu non précisé'}</p>
        <Button variant="secondary" onClick={() => void openVisit(visit.id)}>Consulter la visite</Button>
      </article>)}</div>
      <nav className="visit-actions" aria-label="Pages des visites"><Button variant="secondary" disabled={result.page <= 1} onClick={() => setPage(result.page - 1)}>Précédent</Button><span>Page {result.page} sur {result.lastPage}</span><Button variant="secondary" disabled={result.page >= result.lastPage} onClick={() => setPage(result.page + 1)}>Suivant</Button></nav>
    </>}
    <dialog ref={dialog} className="visit-dialog" aria-labelledby="visit-title" onCancel={event => { if (busy) event.preventDefault(); }} onClose={() => { detailVersion.current++; }}>
      <header className="visit-card-header"><h2 id="visit-title">{heading}</h2><Button variant="secondary" disabled={busy} onClick={() => dialog.current?.close()}>Fermer</Button></header>
      {detailLoading && <p role="status">Chargement du détail…</p>}
      {detailError && <p role="alert" className="visit-error">{detailError}</p>}
      {!!detailId.current && !detailLoading && <Button variant="secondary" disabled={busy} onClick={() => void openVisit(detailId.current!)}>Actualiser le détail</Button>}
      {!detailLoading && mode === 'view' && selected && <>
        <dl className="visit-details">
          <div><dt>Statut</dt><dd>{selected.status ? visitStatuses[selected.status] ?? selected.status : 'Inconnu'}</dd></div>
          <div><dt>Dossier</dt><dd>#{selected.credit_request_id ?? '—'}</dd></div>
          <div><dt>Type</dt><dd>{selected.visit_type ? visitTypes[selected.visit_type] ?? selected.visit_type : '—'}</dd></div>
          <div><dt>Rendez-vous</dt><dd>{dateLabel(selected.scheduled_at)}</dd></div>
          <div><dt>Lieu</dt><dd>{selected.location_label || '—'}</dd></div>
          <div><dt>Coordonnées</dt><dd>{selected.latitude ?? '—'}, {selected.longitude ?? '—'}</dd></div>
          <div><dt>Objet</dt><dd>{selected.purpose || '—'}</dd></div>
          <div><dt>Début</dt><dd>{dateLabel(selected.started_at)}</dd></div>
          <div><dt>Clôture</dt><dd>{dateLabel(selected.completed_at)}</dd></div>
          <div><dt>Conclusion</dt><dd>{selected.outcome ? visitOutcomes[selected.outcome] ?? selected.outcome : '—'}</dd></div>
          <div><dt>Constats</dt><dd>{selected.findings || '—'}</dd></div>
          <div><dt>Recommandations</dt><dd>{selected.recommendations || '—'}</dd></div>
          {(selected.cancellation_reason || selected.reason) && <div><dt>Motif d’annulation / absence</dt><dd>{selected.cancellation_reason || selected.reason}</dd></div>}
        </dl>
        <div className="visit-actions">{actions.edit && <Button variant="secondary" onClick={() => changeMode('edit')}>Modifier</Button>}{actions.start && <Button onClick={() => changeMode('start')}>Démarrer</Button>}{actions.complete && <Button onClick={() => changeMode('complete')}>Rédiger le rapport</Button>}{actions.cancel && <Button variant="danger-subtle" onClick={() => changeMode('cancel')}>Annuler / Client absent</Button>}</div>
      </>}
      {!detailLoading && mode !== 'view' && <form key={`${selected?.id ?? 'new'}-${mode}`} onSubmit={submit}><fieldset className="visit-form" disabled={busy}>
        {(mode === 'create' || mode === 'edit') && <>
          {mode === 'create' && <label>Dossier *<select className="form-control" name="credit_request_id" required defaultValue={eligible.some(row => String(row.id) === requestId) ? requestId : ''}><option value="">Choisir un dossier</option>{eligible.map(row => <option key={row.id} value={row.id}>#{row.id} — {borrowerName(row)}</option>)}</select></label>}
          <div className="visit-grid"><label>Type de visite *<select className="form-control" name="visit_type" required defaultValue={selected?.visit_type ?? 'ACTIVITY_SITE'}>{Object.entries(visitTypes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label>Date et heure *<input className="form-control" name="scheduled_at" type="datetime-local" required defaultValue={localDateTime(selected?.scheduled_at)} /></label><LocationFields visit={selected} /></div>
          <p>Heure locale : {Intl.DateTimeFormat().resolvedOptions().timeZone}.</p><label>Objet de la visite<textarea className="form-control" name="purpose" defaultValue={selected?.purpose ?? ''} /></label>
        </>}
        {mode === 'start' && <p>Confirmez votre arrivée sur place pour démarrer cette visite.</p>}
        {mode === 'complete' && <>
          <p>Le rapport de visite aide à l’analyse du dossier. La décision d’octroi reste une étape distincte.</p>
          <label>Conclusion *<select name="outcome" className="form-control" required defaultValue=""><option value="">Choisir une conclusion</option>{Object.entries(visitOutcomes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label>Constats terrain *<textarea name="findings" className="form-control" required rows={5} /></label><label>Recommandations<textarea name="recommendations" className="form-control" rows={3} /></label><div className="visit-grid"><LocationFields visit={selected} /></div>
        </>}
        {mode === 'cancel' && <><label>Motif *<textarea name="reason" className="form-control" required rows={3} /></label><label className="visit-checkbox"><input type="checkbox" name="as_no_show" /> Le client était absent au rendez-vous</label></>}
        <div className="visit-actions">{selected && <Button variant="secondary" onClick={() => changeMode('view')}>Retour au détail</Button>}<Button type="submit">{busy ? 'Enregistrement…' : { create: 'Planifier la visite', edit: 'Enregistrer les modifications', start: 'Confirmer le démarrage', complete: 'Enregistrer et clôturer', cancel: 'Confirmer la décision' }[mode]}</Button></div>
      </fieldset></form>}
    </dialog>
  </Screen>;
}
