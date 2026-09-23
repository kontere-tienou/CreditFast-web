const PURPOSE_LABELS: Record<string, string> = {
  ACCOUNT_OPENING: 'Ouverture de compte',
  IDENTITY_REVIEW: 'Vérification d’un compte existant',
  ACCOUNT_LINKED: 'Compte rattaché',
};

export function purposeLabel(purpose?: string) {
  return PURPOSE_LABELS[purpose ?? ''] ?? 'Pré-demande';
}

type Fact = { label: string; value: string };
type DocumentRow = { id: number; label: string; filename: string };

export function SavingsRequestStatus({
  reference,
  agencyName,
  approved,
  identityReview,
  legalEntity,
  facts = [],
  documents = [],
  actionLabel,
  onAction,
}: {
  reference: string;
  agencyName: string;
  approved?: boolean;
  identityReview?: boolean;
  legalEntity?: boolean;
  facts?: Fact[];
  documents?: DocumentRow[];
  actionLabel: string;
  onAction: () => void;
}) {
  const steps = [
    { title: 'Demande reçue', detail: 'Enregistrée en ligne' },
    { title: 'Passage en agence', detail: 'Vérification des originaux' },
    { title: 'Ouverture du compte', detail: identityReview ? 'Rattachement après contrôle' : 'Activation en agence' },
  ];
  const current = approved ? 2 : 1;
  const bring = [
    `La référence ${reference}`,
    'L’original de votre pièce d’identité',
    legalEntity ? 'Les documents de l’organisation et le justificatif de pouvoir' : 'Les justificatifs indiqués par l’agence',
  ];
  return (
    <section className="savings-track">
      <div className="savings-track-hero">
        <span className={`savings-track-badge${approved ? ' is-done' : ''}`}>{approved ? 'Finalisation' : 'En attente'}</span>
        <div>
          <h3>{approved ? 'Rattachement en cours' : 'Passage en agence requis'}</h3>
          <p>{identityReview ? 'L’agence vérifie votre identité avant de confirmer le rattachement.' : 'La pré-demande est enregistrée. Le compte s’ouvre après le passage en agence.'}</p>
        </div>
      </div>
      <dl className="savings-track-facts">
        <div><dt>Référence</dt><dd>{reference}</dd></div>
        <div><dt>Agence</dt><dd>{agencyName}</dd></div>
        <div><dt>Démarche</dt><dd>{identityReview ? purposeLabel('IDENTITY_REVIEW') : purposeLabel(approved ? 'ACCOUNT_LINKED' : 'ACCOUNT_OPENING')}</dd></div>
      </dl>
      <ol className="savings-track-steps">
        {steps.map((step, index) => (
          <li key={step.title} className={index < current ? 'is-done' : index === current ? 'is-current' : undefined}>
            <span>{index < current ? '✓' : index + 1}</span>
            <div><strong>{step.title}</strong><small>{step.detail}</small></div>
          </li>
        ))}
      </ol>
      <div className="savings-track-bring">
        <h4>À présenter en agence</h4>
        <ul>{bring.map(item => <li key={item}>{item}</li>)}</ul>
      </div>
      {facts.length > 0 && (
        <dl className="savings-track-grid">
          {facts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}
        </dl>
      )}
      {documents.length > 0 && (
        <ul className="savings-track-docs">
          {documents.map(doc => <li key={doc.id}><strong>{doc.label}</strong><span>{doc.filename}</span></li>)}
        </ul>
      )}
      <button type="button" className="btn btn-secondary" onClick={onAction}>{actionLabel}</button>
    </section>
  );
}
