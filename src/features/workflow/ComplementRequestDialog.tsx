import { useEffect, useState } from "react";
import {
  COMPLEMENT_SUBJECTS,
  type ComplementSubject,
} from "@/api/credit";
import { Button } from "@/shared/ui/Button";
import { Popup } from "@/shared/ui/Popup";

export function ComplementRequestDialog({
  open,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onConfirm: (input: { subject: ComplementSubject; detail: string }) => void;
}) {
  const [subject, setSubject] = useState<ComplementSubject>("PIECE");
  const [detail, setDetail] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }
    setSubject("PIECE");
    setDetail("");
    setError("");
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <Popup
      open
      title="Demander un complément"
      titleId="complement-request-title"
      subtitle="Le dossier reste à votre étape"
      icon="fa-file-circle-plus"
      onClose={onClose}
      closeDisabled={busy}
      zIndex={1400}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (detail.trim().length < 5) {
            setError("Précisez la demande en au moins 5 caractères.");
            return;
          }
          setError("");
          onConfirm({ subject, detail: detail.trim() });
        }}
      >
        <div className="cf-app-modal-body">
          <p style={{ marginTop: 0, fontSize: "0.84rem", color: "var(--text-muted)" }}>
            Le demandeur verra ce sujet en priorité. Le dossier reste à votre étape.
          </p>
          <label className="form-label" htmlFor="complement-subject">
            De quoi s’agit-il ?
          </label>
          <select
            id="complement-subject"
            className="form-control"
            value={subject}
            onChange={(event) => setSubject(event.target.value as ComplementSubject)}
          >
            {(Object.keys(COMPLEMENT_SUBJECTS) as ComplementSubject[]).map((key) => (
              <option key={key} value={key}>
                {COMPLEMENT_SUBJECTS[key]}
              </option>
            ))}
          </select>
          <label className="form-label" htmlFor="complement-detail" style={{ marginTop: "0.85rem" }}>
            Précision
          </label>
          <textarea
            id="complement-detail"
            className="form-control"
            rows={3}
            value={detail}
            placeholder="Indiquez exactement ce qui manque."
            onChange={(event) => setDetail(event.target.value)}
          />
          {error ? (
            <p role="alert" style={{ color: "#991b1b", fontSize: "0.8rem" }}>
              {error}
            </p>
          ) : null}
        </div>
        <div className="cf-app-modal-footer">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button type="submit" disabled={busy}>
            Envoyer au demandeur
          </Button>
        </div>
      </form>
    </Popup>
  );
}
