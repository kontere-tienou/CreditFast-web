import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  createMembership,
  getMembership,
  listCaisses,
  listGuichets,
  type Membership,
  type Caisse,
  type Guichet,
} from "@/api/savings";
import {
  fetchClientProfile,
  hasActiveSavingsAccount,
  type ClientProfile,
} from "@/api/profile";
import { callApp } from "@/shared/ui/legacy";
import { isApiError } from "@/api/errors";
import { getUiSession } from "@/app/session";
import {
  readSavingsSession,
  writeSavingsSession,
  clearSavingsSession,
  SAVINGS_CHANGED,
  type SavingsDraft,
} from "./workflow";
import {
  commonSection,
  closingSection,
  physicalSections,
  legalSections,
  signatorySection,
  physicalDocuments,
  legalDocuments,
  validateMembership,
  type MembershipSection,
} from "./membershipFields";
import "./savings.css";

export const OPEN_SAVINGS_MEMBERSHIP = "creditfast:open-savings-membership";

function Section({
  section,
  values,
}: {
  section: MembershipSection;
  values: Record<string, string>;
}) {
  return (
    <fieldset className="savings-section">
      <legend>{section.title}</legend>
      <div className="savings-grid">
        {section.fields.map((field) => (
          <label key={field.key}>
            {field.label}
            {field.required ? " *" : ""}
            {field.options ? (
              <select
                className="form-control"
                name={field.key}
                required={field.required}
                defaultValue={values[field.key] ?? ""}
              >
                <option value="">Sélectionner</option>
                {field.options.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            ) : (
              <input
                className="form-control"
                name={field.key}
                defaultValue={values[field.key] ?? ""}
                type={field.type ?? "text"}
                required={field.required}
                min={field.type === "number" ? 0 : undefined}
                step={field.type === "number" ? "any" : undefined}
                maxLength={2000}
              />
            )}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function SavingsMembershipModal() {
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const owner = getUiSession()?.userId || getUiSession()?.identifier || "";
  const generation = useRef(0);
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [serviceAvailable, setServiceAvailable] = useState(false);
  const [type, setType] = useState("PHYSICAL_PERSON");
  const [signatories, setSignatories] = useState(1);
  const [caisses, setCaisses] = useState<Caisse[]>([]);
  const [guichets, setGuichets] = useState<Guichet[]>([]);
  const [caisseValue, setCaisseValue] = useState("");
  const [guichetValue, setGuichetValue] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const legal = type === "LEGAL_ENTITY";
  const retained = new Set(
    membership?.documents.map((doc) => doc.key).filter(Boolean),
  );

  function saveDraft() {
    if (!form.current || busy) return;
    const fields = Object.fromEntries(
      [...new FormData(form.current).entries()].filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
    try {
      writeSavingsSession(owner, "draft", {
        clientType: type,
        fields: { ...fields, signatory_count: String(signatories) },
        membershipId: membership?.id,
        savedAt: new Date().toISOString(),
      } satisfies SavingsDraft);
      setNotice(
        "Brouillon enregistré pour cette session. Les fichiers devront être sélectionnés à nouveau à la reprise.",
      );
    } catch {
      setError(
        "Le navigateur ne permet pas de sauvegarder le brouillon. Gardez cette fiche ouverte.",
      );
    }
  }

  function restore(current: Membership | null, clientType?: string | null) {
    const draft = readSavingsSession<SavingsDraft>(owner, "draft");
    const matching =
      draft &&
      draft.membershipId === current?.id &&
      (!clientType || draft.clientType === clientType)
        ? draft
        : null;
    const fields = matching?.fields ?? current?.fields ?? {};
    setValues(fields);
    const chosenType =
      clientType || matching?.clientType || current?.client_type;
    setType(chosenType === "LEGAL_ENTITY" ? "LEGAL_ENTITY" : "PHYSICAL_PERSON");
    setSignatories(
      Math.max(1, Math.min(3, Number(fields.signatory_count) || 1)),
    );
    setCaisseValue(fields.caisse ?? "");
    setGuichetValue(fields.guichet ?? "");
    setCurrentStep(0);
    setNotice(
      matching
        ? "Brouillon repris. Sélectionnez à nouveau les fichiers non encore transmis."
        : "",
    );
  }

  async function refresh() {
    const version = ++generation.current;
    let resolvedClientType: string | null | undefined;
    setLoading(true);
    setError("");
    setLoaded(false);
    setServiceAvailable(false);
    try {
      const next = await fetchClientProfile();
      if (version !== generation.current) return;
      setProfile(next);
      resolvedClientType = next?.client_type;
      setType(
        next?.client_type === "LEGAL_ENTITY"
          ? "LEGAL_ENTITY"
          : "PHYSICAL_PERSON",
      );
      if (hasActiveSavingsAccount(next)) {
        dialog.current?.close();
        callApp("openNewLoanModal");
        return;
      }
      const caisseList = await listCaisses();
      if (version !== generation.current) return;
      setCaisses(caisseList);
      const current = await getMembership(next?.client_type);
      if (version !== generation.current) return;
      setMembership(current);
      restore(current, next?.client_type);
      const savedCaisse = current?.fields?.caisse;
      if (savedCaisse) {
        const guichetList = await listGuichets(Number(savedCaisse));
        if (version !== generation.current) return;
        setGuichets(guichetList);
      }
      setServiceAvailable(true);
      setLoaded(true);
    } catch (cause) {
      if (version === generation.current) {
        const unavailable =
          isApiError(cause) && [404, 405, 501].includes(cause.status);
        if (unavailable) {
          setMembership(null);
          restore(null, resolvedClientType);
          setLoaded(true);
        }
        setError(
          unavailable
            ? "Le service d’adhésion épargne n’est pas encore disponible. Vous pouvez consulter la fiche ; son envoi sera possible dès l’ouverture du service."
            : cause instanceof Error
              ? cause.message
              : "Vérification impossible. Réessayez.",
        );
      }
    } finally {
      if (version === generation.current) setLoading(false);
    }
  }

  useEffect(() => {
    const open = () => {
      if (getUiSession()?.role !== 'CLIENT') return;
      dialog.current?.showModal();
      void refresh();
    };
    window.addEventListener(OPEN_SAVINGS_MEMBERSHIP, open);
    return () => {
      generation.current++;
      window.removeEventListener(OPEN_SAVINGS_MEMBERSHIP, open);
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !serviceAvailable) return;
    const emptyRequired = [
      ...event.currentTarget.querySelectorAll<
        HTMLInputElement | HTMLSelectElement
      >(
        'input[required]:not([type="file"]):not([type="checkbox"]), select[required]',
      ),
    ].find((field) => !field.value.trim());
    if (emptyRequired) {
      setError("Renseignez tous les champs obligatoires.");
      emptyRequired.focus();
      return;
    }
    const data = new FormData(event.currentTarget);
    const fields = Object.fromEntries(
      [...data.entries()]
        .filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        )
        .map(([key, value]) => [key, value.trim()]),
    );
    const invalid = validateMembership(fields, data, legal, retained);
    if (invalid) {
      setError(invalid);
      return;
    }
    const body = new FormData();
    body.set("client_type", type);
    body.set(
      "fields",
      JSON.stringify({
        ...fields,
        signatory_count: legal ? String(signatories) : "0",
      }),
    );
    for (const [key, file] of data.entries()) {
      if (!(file instanceof File) || !file.size) continue;
      if (
        !["application/pdf", "image/jpeg", "image/png"].includes(file.type) ||
        file.size > 10 * 1024 * 1024
      ) {
        setError("Chaque pièce doit être un PDF, JPG ou PNG de 10 Mo maximum.");
        return;
      }
      body.append(`documents[${key}]`, file);
    }
    setBusy(true);
    setError("");
    if (membership?.id)
      body.set(
        "retained_document_ids",
        JSON.stringify(membership.documents.map((doc) => doc.id)),
      );
    try {
      setMembership(await createMembership(body, membership?.id, type));
      clearSavingsSession(owner, "draft");
      setNotice("Adhésion transmise. Elle est en attente de validation.");
      window.dispatchEvent(new Event(SAVINGS_CHANGED));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Enregistrement impossible.",
      );
    } finally {
      setBusy(false);
    }
  }

  function validateStep(step: number) {
    const root = form.current?.querySelector<HTMLElement>(
      `[data-savings-step="${step}"]`,
    );
    const invalid = root?.querySelector<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >(
      'input[required]:not([type="file"]):not([type="checkbox"]), select[required], textarea[required], input[type="file"][required]',
    );
    if (invalid && !invalid.value.trim()) {
      setError("Renseignez les champs obligatoires de cette étape.");
      invalid.focus();
      return false;
    }
    setError("");
    return true;
  }

  function nextStep() {
    if (validateStep(currentStep)) {
      setCurrentStep((step) => Math.min(3, step + 1));
    }
  }

  const waiting =
    membership?.status === "PENDING" || membership?.status === "APPROVED";
  return (
    <dialog
      ref={dialog}
      className="savings-dialog"
      aria-labelledby="savings-title"
      onCancel={(event) => {
        if (busy) event.preventDefault();
        else saveDraft();
      }}
      onClose={() => {
        generation.current++;
        setLoaded(false);
        setMembership(null);
        setError("");
      }}
    >
      <header className="savings-header">
        <div>
          <h2 id="savings-title">Ouvrir un compte épargne</h2>
          <p>Demande d’ouverture auprès de la banque</p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy}
          onClick={() => {
            saveDraft();
            dialog.current?.close();
          }}
          aria-label="Fermer"
        >
          Fermer
        </button>
      </header>
      <div className="savings-content">
        <p>
          Une demande de prêt nécessite un compte épargne actif. Votre adhésion
          restera en attente jusqu’à sa validation par l’administrateur. Le
          numéro de compte sera attribué à la validation.
        </p>
        {error && (
          <p role="alert" className="savings-error">
            {error}
          </p>
        )}
        {notice && <p role="status">{notice}</p>}
        {loading && <p role="status">Vérification du compte épargne…</p>}
        {!loading && !loaded && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void refresh()}
          >
            Réessayer
          </button>
        )}
        {loaded && !serviceAvailable && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void refresh()}
          >
            Vérifier la disponibilité
          </button>
        )}
        {loaded && waiting && (
          <div role="status">
            <h3>
              {membership.status === "PENDING"
                ? "Adhésion en attente de validation"
                : "Adhésion validée — activation du compte en cours"}
            </h3>
            <p>
              Vous pourrez faire votre demande de prêt dès que votre compte
              épargne sera actif.
            </p>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => void refresh()}
            >
              Actualiser le statut
            </button>
          </div>
        )}
        {loaded && !waiting && (
          <form ref={form} onSubmit={submit} onChange={saveDraft}>
            <nav className="savings-stepper" aria-label="Étapes de l’adhésion">
              {["Profil", "Situation", "Pièces", "Confirmation"].map(
                (label, index) => (
                  <button
                    key={label}
                    type="button"
                    className={
                      currentStep === index
                        ? "is-active"
                        : currentStep > index
                          ? "is-complete"
                          : ""
                    }
                    onClick={() => {
                      if (index <= currentStep || validateStep(currentStep))
                        setCurrentStep(index);
                    }}
                  >
                    <span>{index + 1}</span>
                    {label}
                  </button>
                ),
              )}
            </nav>
            {membership?.status === "CHANGES_REQUESTED" && (
              <p role="status">
                À compléter : {membership.correction_reason}. Corrigez la fiche
                et renvoyez-la pour validation.
              </p>
            )}
            {!!membership?.documents.length && (
              <p>
                Pièces déjà transmises conservées :{" "}
                {membership.documents.map((doc) => doc.label).join(", ")}. Vous
                pouvez remplacer une pièce en sélectionnant un nouveau fichier.
              </p>
            )}
            {membership?.status === "REJECTED" && (
              <p role="status">
                Adhésion refusée :{" "}
                {membership.rejection_reason ||
                  "Contactez votre chargé de crédit."}{" "}
                Vous pouvez soumettre une nouvelle fiche.
              </p>
            )}
            <fieldset disabled={busy} className="savings-form-body">
              <div data-savings-step="0" hidden={currentStep !== 0}>
                <label>
                  Type de demandeur
                  <select
                    className="form-control"
                    value={type}
                    disabled={["PHYSICAL_PERSON", "LEGAL_ENTITY"].includes(
                      profile?.client_type ?? "",
                    )}
                    onChange={(event) => setType(event.target.value)}
                  >
                    <option value="PHYSICAL_PERSON">Personne physique</option>
                    <option value="LEGAL_ENTITY">Personne morale</option>
                  </select>
                </label>
                <fieldset className="savings-section">
                  <legend>{commonSection.title}</legend>
                  <div className="savings-grid">
                    <label>
                      Caisse *
                      <select
                        className="form-control"
                        name="caisse"
                        required
                        value={caisseValue}
                        onChange={async (event) => {
                          const selected = event.target.value;
                          setCaisseValue(selected);
                          setGuichetValue("");
                          setGuichets(
                            selected
                              ? await listGuichets(Number(selected))
                              : [],
                          );
                        }}
                      >
                        <option value="">Sélectionner une caisse</option>
                        {caisses.map((caisse) => (
                          <option key={caisse.id} value={caisse.id}>
                            {caisse.name ||
                              caisse.label ||
                              `Caisse #${caisse.id}`}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Guichet *
                      <select
                        className="form-control"
                        name="guichet"
                        required
                        value={guichetValue}
                        disabled={!caisseValue || guichets.length === 0}
                        onChange={(event) =>
                          setGuichetValue(event.target.value)
                        }
                      >
                        <option value="">Sélectionner un guichet</option>
                        {guichets.map((guichet) => (
                          <option key={guichet.id} value={guichet.id}>
                            {guichet.name ||
                              guichet.label ||
                              `Guichet #${guichet.id}`}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </fieldset>
              </div>
              <div key={type}>
                {legal ? (
                  <>
                    <div data-savings-step="1" hidden={currentStep !== 1}>
                      <Section values={values} section={legalSections[0]} />
                    </div>
                    <div data-savings-step="2" hidden={currentStep !== 2}>
                      <label>
                        Nombre de signataires
                        <select
                          className="form-control"
                          value={signatories}
                          onChange={(event) =>
                            setSignatories(Number(event.target.value))
                          }
                        >
                          {[1, 2, 3].map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </label>
                      {Array.from({ length: signatories }, (_, i) => (
                        <Section
                          values={values}
                          key={i}
                          section={signatorySection(i + 1)}
                        />
                      ))}
                      {legalSections.slice(1).map((section) => (
                        <Section
                          values={values}
                          key={section.title}
                          section={section}
                        />
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <div data-savings-step="1" hidden={currentStep !== 1}>
                      {physicalSections.slice(0, 2).map((section) => (
                        <Section
                          values={values}
                          section={section}
                          key={section.title}
                        />
                      ))}
                    </div>
                    <div data-savings-step="2" hidden={currentStep !== 2}>
                      {physicalSections.slice(2).map((section) => (
                        <Section
                          values={values}
                          section={section}
                          key={section.title}
                        />
                      ))}
                    </div>
                  </>
                )}
                <div data-savings-step="2" hidden={currentStep !== 2}>
                  <p>
                    La classification du risque est réservée à l’administrateur.
                  </p>
                  <fieldset className="savings-section">
                    <legend>5. Pièces fournies</legend>
                    <p>
                      Copies certifiées lorsque demandées. PDF, JPG ou PNG, 10
                      Mo maximum par fichier. Les pièces sélectionnées seront
                      transmises avec la fiche.
                    </p>
                    <div className="savings-grid">
                      {(legal ? legalDocuments : physicalDocuments).map(
                        ([key, label, required]) => (
                          <label key={key}>
                            {label}
                            {required ? " *" : ""}
                            <input
                              type="file"
                              name={key}
                              required={required && !retained.has(key)}
                              accept=".pdf,.jpg,.jpeg,.png"
                            />
                          </label>
                        ),
                      )}
                      {legal &&
                        Array.from({ length: signatories }, (_, i) =>
                          ["photo", "signature"].map((kind) => (
                            <label key={`${i}-${kind}`}>
                              {kind === "photo" ? "Photo" : "Signature"} du
                              signataire {i + 1} *
                              <input
                                type="file"
                                name={`signatory_${i + 1}_${kind}`}
                                required={
                                  !retained.has(`signatory_${i + 1}_${kind}`)
                                }
                                accept=".pdf,.jpg,.jpeg,.png"
                              />
                            </label>
                          )),
                        )}
                    </div>
                  </fieldset>
                </div>
                <div data-savings-step="3" hidden={currentStep !== 3}>
                  <Section values={values} section={closingSection} />
                  <label>
                    <input type="checkbox" required /> Je certifie l’exactitude
                    des informations et demande l’ouverture d’un compte épargne.
                  </label>
                </div>
              </div>
              <div className="savings-step-actions">
                <p>
                  * Champ obligatoire. La signature de la caisse sera renseignée
                  lors de la validation.
                </p>

                <div className="savings-step-actions-buttons">
                  {currentStep > 0 && (
                    <button
                      className="btn btn-secondary"
                      type="button"
                      onClick={() =>
                        setCurrentStep((step) => Math.max(0, step - 1))
                      }
                    >
                      Retour
                    </button>
                  )}

                  {currentStep < 3 ? (
                    <button
                      className="btn btn-primary"
                      type="button"
                      onClick={nextStep}
                    >
                      Continuer
                    </button>
                  ) : (
                    <button
                      className="btn btn-primary"
                      type="submit"
                      disabled={!serviceAvailable || busy}
                    >
                      {busy
                        ? "Envoi en cours…"
                        : membership
                          ? "Renvoyer pour validation"
                          : "Soumettre mon adhésion"}
                    </button>
                  )}
                </div>
              </div>
            </fieldset>
          </form>
        )}
      </div>
    </dialog>
  );
}
