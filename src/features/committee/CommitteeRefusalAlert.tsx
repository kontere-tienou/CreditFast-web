import { useEffect, useState } from 'react';
import { COMPLEMENT_SUBJECTS, type ComplementSubject, submitCommitteeDecision } from '@/api/credit';
import { isApiError } from '@/api';
import { Button } from '@/shared/ui/Button';
import { Popup } from '@/shared/ui/Popup';
import { toast } from '@heroui/react';
import { getSelectedCreditRequestId, notifyRequestsChanged } from '@/features/workflow/workflow';
import { closeCommitteeDrawer, closeCommitteeModal } from './fillCommittee';

export function CommitteeRefusalAlert({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [what, setWhat] = useState('');
  const [subject, setSubject] = useState<ComplementSubject>('INFORMATION');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason('');
    setWhat('');
    setSubject('INFORMATION');
    setError('');
    setBusy(false);
  }, [open]);

  if (!open) return null;

  const submit = async (decision: 'ADJOURNED' | 'VERIFICATION_REQUIRED') => {
    const why = reason.trim();
    const ask = what.trim();
    if (why.length < 5 || ask.length < 5) {
      setError('Précisez le pourquoi et le quoi, en au moins 5 caractères.');
      return;
    }
    const id = getSelectedCreditRequestId();
    if (!id) {
      setError('Ouvrez d’abord un dossier.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await submitCommitteeDecision(id, {
        decision,
        comment: why,
        reason: why,
        what: ask,
        ...(decision === 'VERIFICATION_REQUIRED' ? { subject } : {}),
      });
      closeCommitteeModal();
      closeCommitteeDrawer();
      notifyRequestsChanged();
      toast.success(decision === 'ADJOURNED' ? 'Dossier ajourné. Le client voit le motif.' : 'Complément transmis à l’agent.');
      onClose();
    } catch (caught) {
      setError(isApiError(caught) ? caught.message : 'La décision n’a pas pu être enregistrée.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popup
      open
      size="md"
      title="Refus du comité"
      titleId="committee-refusal-title"
      subtitle="Le dossier n’est pas encore tranché"
      icon="fa-circle-xmark"
      onClose={onClose}
      closeDisabled={busy}
      zIndex={2700}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit('ADJOURNED');
        }}
      >
        <div className="cf-app-modal-body">
          <p style={{ marginTop: 0, fontSize: '0.84rem', color: 'var(--text-muted)' }}>
            Le pourquoi et le quoi sont obligatoires. Ajourner laisse le dossier consultable. Le complément le renvoie à l’agent.
          </p>
          <label className="form-label" htmlFor="committee-refusal-reason">Pourquoi</label>
          <textarea id="committee-refusal-reason" className="form-control" rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motif du refus" />
          <label className="form-label" htmlFor="committee-refusal-what" style={{ marginTop: '0.85rem' }}>Quoi</label>
          <textarea id="committee-refusal-what" className="form-control" rows={3} value={what} onChange={(event) => setWhat(event.target.value)} placeholder="Ce qui manque ou ce qui doit changer" />
          <label className="form-label" htmlFor="committee-refusal-subject" style={{ marginTop: '0.85rem' }}>Sujet du complément pour l’agent</label>
          <select id="committee-refusal-subject" className="form-control" value={subject} onChange={(event) => setSubject(event.target.value as ComplementSubject)}>
            {(Object.keys(COMPLEMENT_SUBJECTS) as ComplementSubject[]).map((key) => (
              <option key={key} value={key}>{COMPLEMENT_SUBJECTS[key]}</option>
            ))}
          </select>
          {error ? <p style={{ color: 'var(--danger, #b91c1c)', fontSize: '0.82rem', marginBottom: 0 }}>{error}</p> : null}
        </div>
        <div className="cf-app-modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Annuler</Button>
          <Button type="submit" variant="warning" disabled={busy}>Ajourner</Button>
          <Button type="button" variant="danger" disabled={busy} onClick={() => void submit('VERIFICATION_REQUIRED')}>Demander un complément à l’agent</Button>
        </div>
      </form>
    </Popup>
  );
}
