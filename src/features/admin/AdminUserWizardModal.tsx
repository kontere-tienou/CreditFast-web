import { useEffect, useState, type FormEvent } from "react";
import { toast } from "@heroui/react";
import { isApiError } from "@/api";
import {
  STAFF_ROLE_CATALOG,
  STAFF_ROLES,
  createAdminUser,
  isStaffRole,
  roleLabel,
  type StaffRole,
} from "@/api/admin";
import { Button } from "@/shared/ui/Button";
import { AppModal } from "@/shared/ui/AppModal";
import { ConfirmAlert } from "@/shared/ui/ConfirmAlert";
import { CfSelect } from "@/shared/ui/CfSelect";

type AdminUserWizardModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<void> | void;
};

const EMPTY = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  password: "",
  password_confirm: "",
  role: "admin" as StaffRole,
};

const CREATE_ROLES: StaffRole[] = [...STAFF_ROLES];

export function AdminUserWizardModal({
  open,
  onClose,
  onCreated,
}: AdminUserWizardModalProps) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(EMPTY);
      setConfirmOpen(false);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast.warning("Saisissez le prénom et le nom.");
      return;
    }
    if (!form.email.trim() || !form.email.includes("@")) {
      toast.warning("Saisissez un e-mail professionnel valide.");
      return;
    }
    if (form.password.length < 8) {
      toast.warning("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (form.password !== form.password_confirm) {
      toast.warning("La confirmation du mot de passe ne correspond pas.");
      return;
    }

    setConfirmOpen(true);
  };

  const createAccount = async () => {
    setSaving(true);
    try {
      if (isStaffRole(form.role)) {
        await createAdminUser({
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          password: form.password,
          role: form.role,
        });
        toast.success("Compte interne créé.");
      }
      setConfirmOpen(false);
      onClose();
      await onCreated();
    } catch (error) {
      toast.danger(isApiError(error) ? error.message : "Création impossible.");
    } finally {
      setSaving(false);
    }
  };

  const roleHint = STAFF_ROLE_CATALOG[form.role].summary;

  return (
    <>
      <AppModal
        className="cf-user-wizard-modal"
        title="Créer un utilisateur"
        titleId="admin-create-user-title"
        subtitle="Compte interne par e-mail professionnel"
        icon="fa-user-plus"
        closeDisabled={saving || confirmOpen}
        onClose={() => {
          if (!saving && !confirmOpen) {
            onClose();
          }
        }}
      >

          <form onSubmit={(event) => void onSubmit(event)}>
            <div className="cf-app-modal-body">
              <div className="admin-form-grid">
                <label className="form-group">
                  <span className="form-label">Prénom *</span>
                  <input
                    className="form-control"
                    required
                    autoFocus
                    value={form.first_name}
                    onChange={(event) =>
                      setForm({ ...form, first_name: event.target.value })
                    }
                  />
                </label>
                <label className="form-group">
                  <span className="form-label">Nom *</span>
                  <input
                    className="form-control"
                    required
                    value={form.last_name}
                    onChange={(event) =>
                      setForm({ ...form, last_name: event.target.value })
                    }
                  />
                </label>
                <label className="form-group">
                  <span className="form-label">E-mail professionnel *</span>
                  <input
                    className="form-control"
                    type="email"
                    required
                    placeholder="prenom.nom@creditfast.ml"
                    value={form.email}
                    onChange={(event) =>
                      setForm({ ...form, email: event.target.value })
                    }
                  />
                </label>
                <label className="form-group">
                  <span className="form-label">Téléphone</span>
                  <input
                    className="form-control"
                    type="tel"
                    placeholder="+223 70 12 34 56"
                    value={form.phone}
                    onChange={(event) =>
                      setForm({ ...form, phone: event.target.value })
                    }
                  />
                </label>
                <label className="form-group" style={{ gridColumn: "1 / -1" }}>
                  <span className="form-label">Rôle *</span>
                  <CfSelect
                    className="form-control"
                    value={form.role}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        role: event.target.value as StaffRole,
                      })
                    }
                  >
                    {CREATE_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {roleLabel(role)}
                      </option>
                    ))}
                  </CfSelect>
                  <small className="form-hint">{roleHint}</small>
                </label>
                <label className="form-group">
                  <span className="form-label">Mot de passe *</span>
                  <input
                    className="form-control"
                    type="password"
                    minLength={8}
                    required
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(event) =>
                      setForm({ ...form, password: event.target.value })
                    }
                  />
                </label>
                <label className="form-group">
                  <span className="form-label">Confirmation *</span>
                  <input
                    className="form-control"
                    type="password"
                    minLength={8}
                    required
                    autoComplete="new-password"
                    value={form.password_confirm}
                    onChange={(event) =>
                      setForm({ ...form, password_confirm: event.target.value })
                    }
                  />
                </label>
              </div>
            </div>

            <div className="cf-app-modal-footer">
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={onClose}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={saving}>
                <i className="fas fa-user-plus"></i>{" "}
                {saving ? "Création…" : "Créer le compte"}
              </Button>
            </div>
          </form>
      </AppModal>
      <ConfirmAlert
        open={confirmOpen}
        title="Créer le compte interne"
        message={`Créer le compte ${roleLabel(form.role)} pour ${form.first_name.trim()} ${form.last_name.trim()} ?`}
        confirmLabel="Créer le compte"
        tone="primary"
        busy={saving}
        onCancel={() => {
          if (!saving) {
            setConfirmOpen(false);
          }
        }}
        onConfirm={() => {
          void createAccount();
        }}
      />
    </>
  );
}
