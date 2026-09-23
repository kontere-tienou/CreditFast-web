import { Button } from '@/shared/ui/Button';
import { Popup } from '@/shared/ui/Popup';

export type ConfirmAlertTone = 'primary' | 'danger' | 'warning';

export type ConfirmAlertProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmAlertTone;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

const ICONS: Record<ConfirmAlertTone, string> = {
  primary: 'fa-circle-question',
  danger: 'fa-triangle-exclamation',
  warning: 'fa-triangle-exclamation',
};

export function ConfirmAlert({
  open,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  tone = 'primary',
  busy = false,
  onCancel,
  onConfirm,
}: ConfirmAlertProps) {
  return (
    <Popup
      open={open}
      title={title}
      titleId="cf-confirm-alert-title"
      describedBy="cf-confirm-alert-message"
      subtitle="Confirmation requise"
      icon={ICONS[tone]}
      onClose={onCancel}
      closeDisabled={busy}
    >
      <div className="cf-app-modal-body">
        <p id="cf-confirm-alert-message" style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.5 }}>
          {message}
        </p>
      </div>
      <div className="cf-app-modal-footer">
        <Button type="button" variant="secondary" disabled={busy} onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button type="button" variant={tone === 'danger' ? 'danger' : tone === 'warning' ? 'warning' : 'primary'} disabled={busy} onClick={onConfirm}>
          {busy ? 'En cours…' : confirmLabel}
        </Button>
      </div>
    </Popup>
  );
}
