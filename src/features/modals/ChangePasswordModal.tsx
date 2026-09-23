import { useEffect, useState, type FormEvent } from 'react';
import { toast } from '@heroui/react';
import { isApiError, updateOwnPassword } from '@/api';
import { AppModal } from '@/shared/ui/AppModal';
import { Button } from '@/shared/ui/Button';

type ChangePasswordModalProps = {
  open?: boolean;
  onClose: () => void;
};

export function ChangePasswordModal({ open = false, onClose }: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!currentPassword) {
      toast.warning('Saisissez votre mot de passe actuel.');
      return;
    }
    if (newPassword.length < 8) {
      toast.warning('Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.warning('La confirmation ne correspond pas au nouveau mot de passe.');
      return;
    }
    setSaving(true);
    try {
      await updateOwnPassword({
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: confirmPassword,
      });
      toast.success('Mot de passe modifié.');
      onClose();
    } catch (error) {
      toast.danger(isApiError(error) ? error.message : 'Impossible de modifier le mot de passe.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal
      size="sm"
      title="Sécurité du compte"
      titleId="change-password-title"
      subtitle="Votre mot de passe actuel est demandé pour confirmer."
      icon="fa-shield-halved"
      onClose={onClose}
      closeDisabled={saving}
    >
        <form onSubmit={(event) => void onSubmit(event)}>
          <div className="cf-app-modal-body">
            <div className="admin-form-grid">
              <label className="form-group" style={{ gridColumn: '1 / -1' }}>
                <span className="form-label">Mot de passe actuel</span>
                <input
                  className="form-control"
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                  autoFocus
                />
              </label>
              <label className="form-group">
                <span className="form-label">Nouveau mot de passe</span>
                <input
                  className="form-control"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                />
              </label>
              <label className="form-group">
                <span className="form-label">Confirmation</span>
                <input
                  className="form-control"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                />
              </label>
            </div>
            <p style={{ margin: '0.75rem 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>Au moins 8 caractères. Évitez un mot de passe déjà utilisé ailleurs.</p>
          </div>

          <div className="cf-app-modal-footer">
            <Button type="button" variant="secondary" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving}>
              <i className="fas fa-key"></i> {saving ? 'Enregistrement…' : 'Changer le mot de passe'}
            </Button>
          </div>
        </form>
    </AppModal>
  );
}
