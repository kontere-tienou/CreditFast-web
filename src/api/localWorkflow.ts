/** Browser-only workflow prototype. No remote fallback and no real authentication. */
type Row = Record<string, any>;
type Store = { nextId: number; users: Row[]; profiles: Row[]; applications: Row[]; requests: Row[]; documents: Row[]; guarantees: Row[]; activities: Row[]; visits: Row[] };
const KEY = 'creditfast:local-workflow:v1';
const now = () => new Date().toISOString();
const response = (data: unknown, status = 200) => Response.json(data, { status });
const failure = (message: string, status = 422) => response({ message }, status);
const collection = (data: Row[]) => response({ data, current_page: 1, last_page: 1, total: data.length });
export const DEMO_ACCOUNTS = [
  { label: 'Client avec épargne', identifier: '+22370000001' },
  { label: 'Client sans épargne', identifier: '+22370000002' },
  { label: 'Profil à compléter', identifier: '+22370000003' },
  { label: 'Agent', identifier: 'agent@demo.creditfast' },
  { label: 'Analyste', identifier: 'analyst@demo.creditfast' },
  { label: 'Comité', identifier: 'committee@demo.creditfast' },
  { label: 'Administrateur', identifier: 'admin@demo.creditfast' },
];
function seed(): Store {
  const users = DEMO_ACCOUNTS.map((entry, i) => ({ id: i + 1, full_name: entry.label, first_name: 'Démo', last_name: entry.label, phone: i < 3 ? entry.identifier : null, email: i >= 3 ? entry.identifier : null, role: ['client', 'client', 'client', 'credit_agent', 'analyst', 'committee_member', 'admin'][i], status: 'active' }));
  return { nextId: 100, users, profiles: users.slice(0, 3).map(user => ({ id: user.id, user, client_number: `DEMO-${user.id}`, client_type: 'PHYSICAL_PERSON', city: 'Bamako', occupation: 'Commerce', kyc_status: user.id === 3 ? 'PENDING' : 'VERIFIED', financial_accounts: user.id === 2 ? [] : [{ id: user.id, account_number: `DEMO-EP-${user.id}`, account_type: 'EPARGNE', status: 'ACTIF', balance: 500000 }], financial_profile: { monthly_income: 450000, monthly_expenses: 150000, existing_debt_payment: 0 } })), applications: [], requests: [], documents: [1, 2].map(id => ({ id, client_id: id, document_type: 'CNI', status: 'VERIFIED', original_filename: 'identite-fictive.txt', uploaded_at: now(), seeded: true })), guarantees: [], activities: [], visits: [] };
}
function readStore(): Store {
  const raw = localStorage.getItem(KEY);
  if (!raw) { const initial = seed(); save(initial); return initial; }
  return JSON.parse(raw) as Store;
}
function save(store: Store) { localStorage.setItem(KEY, JSON.stringify(store)); }

// Keep uploaded files across reloads without putting binary data in localStorage.
async function fileStore(key: string, blob?: Blob): Promise<Blob | undefined> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('creditfast-local-files', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('files');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const transaction = db.transaction('files', blob ? 'readwrite' : 'readonly');
      const request = blob ? transaction.objectStore('files').put(blob, key) : transaction.objectStore('files').get(key);
      transaction.oncomplete = () => { db.close(); resolve(blob ?? request.result); };
      transaction.onerror = () => { db.close(); reject(transaction.error); };
    };
  });
}
async function bodyOf(init: RequestInit): Promise<Row> {
  if (init.body instanceof FormData) {
    const body: Row = {};
    for (const [key, value] of init.body) if (typeof value === 'string') body[key] = value;
    return body;
  }
  return typeof init.body === 'string' ? JSON.parse(init.body) : {};
}
async function attachFile(row: Row, init: RequestInit, key: string, field = 'file') {
  const file = init.body instanceof FormData ? init.body.get(field) : null;
  if (file instanceof Blob && file.size) {
    await fileStore(key, file);
    Object.assign(row, { original_filename: file instanceof File ? file.name : 'document', mime_type: file.type, file_size: file.size, has_file: true });
  }
}

// Serialize mutations so simultaneous component requests cannot overwrite each other.
let queue: Promise<unknown> = Promise.resolve();
export function localWorkflowRequest(path: string, init: RequestInit = {}, token?: string): Promise<Response> {
  const result = queue.then(() => handle(path, init, token)).catch(error => failure(error instanceof Error ? error.message : 'Stockage local indisponible.', 500));
  queue = result;
  return result;
}
async function handle(rawPath: string, init: RequestInit, token?: string): Promise<Response> {
  const url = new URL(rawPath, 'http://local.invalid');
  const path = url.pathname;
  const body = await bodyOf(init);
  const method = String(body._method ?? init.method ?? 'GET').toUpperCase();
  const store = readStore();
  const commit = (value: unknown) => { save(store); return response(value); };
  const make = (extra: Row = {}): Row => ({ ...body, ...extra, id: store.nextId++, created_at: now() });

  if (path === '/auth/register' && method === 'POST') {
    if (store.users.some(user => user.phone === body.phone)) return failure('Ce numéro possède déjà un accès local. Connectez-vous.');
    const { password: _password, ...fields } = body;
    const user = { ...fields, id: store.nextId++, role: 'client', full_name: `${body.first_name} ${body.last_name}`, status: 'active' };
    store.users.push(user);
    store.profiles.push({ ...fields, id: user.id, user, client_number: `DEMO-${user.id}`, financial_accounts: [], kyc_status: 'PENDING' });
    return commit({ user });
  }
  if (/^\/auth\/(client|staff)\/login$/.test(path) && method === 'POST') {
    const user = store.users.find(row => body.phone ? row.phone === body.phone : row.email === body.email);
    if (!user) return failure('Compte local inconnu. Utilisez un scénario de démonstration ou créez un accès.', 401);
    return response({ token: `local-workflow:${user.id}`, user });
  }
  const user = store.users.find(row => token === `local-workflow:${row.id}`);
  if (!user) return failure('Ouvrez un scénario local pour continuer.', 401);
  const client = store.profiles.find(row => row.id === user.id);
  const staff = user.role !== 'client';
  if (path === '/auth/me') return response({ user });
  const savingsHistory = path.match(/^\/profile\/financial-accounts\/(\d+)\/transactions$/);
  if (savingsHistory && method === 'GET') {
    const account = client?.financial_accounts.find((row: Row) => row.id === Number(savingsHistory[1]));
    if (!account) return failure('Compte introuvable.', 404);
    if (!account.transactions) {
      account.transactions = [];
      // Upgrade the original example accounts only; never invent movements for other balances.
      if ([1, 3].includes(account.id) && account.balance === 500000) {
        const entries = [
          ['2026-09-01', 'Versement initial', 'DEPOSIT', 'CREDIT', 300000, 'COMPLETED', 300000, 'Agence'],
          ['2026-09-05', 'Virement reçu', 'TRANSFER', 'CREDIT', 250000, 'COMPLETED', 550000, 'Virement bancaire'],
          ['2026-09-10', 'Retrait au guichet', 'WITHDRAWAL', 'DEBIT', 50000, 'COMPLETED', 500000, 'Agence'],
          ['2026-09-15', 'Intérêts crédités', 'INTEREST', 'CREDIT', 5000, 'COMPLETED', 505000, 'Compte épargne'],
          ['2026-09-16', 'Frais de tenue de compte', 'FEE', 'DEBIT', 5000, 'COMPLETED', 500000, 'Compte épargne'],
          ['2026-09-22', 'Versement en cours', 'DEPOSIT', 'CREDIT', 20000, 'PENDING', undefined, 'Agence'],
        ];
        account.transactions = entries.map(([booked_at, label, type, direction, amount, status, balance_after, channel], index) => ({ id: store.nextId++, reference: `EP-${account.id}-${String(index + 1).padStart(4, '0')}`, booked_at, label, type, direction, amount, status, balance_after, channel }));
      }
      save(store);
    }
    return collection(account.transactions);
  }
  if (path === '/auth/logout') return response({ message: 'Session locale fermée.' });
  if (path === '/profile-photo') return method === 'GET' ? response({ has_photo: false }) : failure('La photo de profil sera traitée dans une prochaine étape du prototype.', 501);
  if (path === '/profile') {
    if (!client) return failure('Profil client introuvable.', 404);
    if (method === 'PUT') { Object.assign(client, body); return commit({ client }); }
    return response({ client: { ...client, financial_accounts: client.financial_accounts.map((account: Row) => ({
      ...account,
      blocked_balance: account.blocked_balance ?? 0,
      holder_name: account.holder_name ?? (client.client_type === 'LEGAL_ENTITY' ? client.company_name : client.user.full_name),
      opened_at: account.opened_at ?? (account.id <= 3 ? '2026-09-01' : undefined),
      caisse_name: account.caisse_name ?? (account.id <= 3 ? 'Bamako Centre' : undefined),
      guichet_name: account.guichet_name ?? (account.id <= 3 ? 'Hamdallaye' : undefined),
      available_balance: account.available_balance ?? Math.max(0, Number(account.balance ?? 0) - Number(account.blocked_balance ?? 0)),
    })) } });
  }
  if (path === '/profile/financial-profile' && client) {
    if (method === 'GET') return response({ financial_profile: client.financial_profile ?? {} });
    client.financial_profile = body; return commit({ financial_profile: body });
  }
  if (path === '/caisses') return collection([{ id: 1, name: 'Bamako Centre' }]);
  if (/^\/caisses\/\d+\/guichets$/.test(path)) return collection([{ id: 1, name: 'Hamdallaye' }]);
  if (path === '/notifications') return collection([]);
  if (path === '/credit-products') return collection([{ credit_type: 'PROFESSIONAL_WORKING_CAPITAL', label: 'Fonds de roulement', min_amount: 50000, max_amount: 10000000, min_duration_months: 3, max_duration_months: 36 }, { credit_type: 'CONSUMER_PERSONAL', label: 'Prêt personnel', min_amount: 50000, max_amount: 5000000, min_duration_months: 3, max_duration_months: 36 }]);
  if (path === '/simulations/installments' && method === 'POST') return response({ scenarios: (body.scenarios ?? []).map((scenario: Row) => ({ ...scenario, monthly_payment: Number(scenario.requested_amount) / Math.max(1, Number(scenario.duration_months)), total_interest: 0, total_amount: Number(scenario.requested_amount), repayment_capacity_status: 'DEMO' })) });

  const membership = path.match(/^\/(agent\/)?bank-account-applications\/(physical-person|legal-entity)(?:\/(\d+))?(?:\/(submit|approve|reject|return))?$/);
  if (membership) {
    const [, agent, kind, rawId, action] = membership;
    if (agent && !staff) return failure('Espace équipe uniquement.', 403);
    const type = kind === 'legal-entity' ? 'LEGAL_ENTITY' : 'PHYSICAL_PERSON';
    const rows = store.applications.filter(row => row.client_type === type && (staff || row.client_id === user.id));
    if (!rawId && method === 'GET') return collection(rows.filter(row => !url.searchParams.get('status') || row.status === url.searchParams.get('status')));
    let row = rows.find(item => item.id === Number(rawId));
    if (!rawId && method === 'POST') {
      row = make({ client_id: user.id, client_type: type, applicant_name: user.full_name, status: 'DRAFT', fields: {}, documents: [] });
      store.applications.push(row);
    }
    if (!row) return failure('Demande d’ouverture introuvable.', 404);
    if (action) {
      if (action !== 'submit' && !['admin', 'credit_agent'].includes(user.role)) return failure('Validation réservée à l’équipe.', 403);
      row.status = ({ submit: 'PENDING', approve: 'APPROVED', reject: 'REJECTED', return: 'CHANGES_REQUESTED' } as Row)[action];
      row.correction_reason = action === 'return' ? body.reason : undefined;
      row.rejection_reason = action === 'reject' ? body.reason : undefined;
      if (action === 'approve') {
        const owner = store.profiles.find(profile => profile.id === row!.client_id);
        if (owner && !owner.financial_accounts.length) owner.financial_accounts.push({ id: store.nextId++, account_number: body.account_number || `DEMO-EP-${owner.id}`, account_type: 'EPARGNE', status: 'ACTIF', balance: 0, opened_at: now(), caisse_name: String(row.fields.caisse) === '1' ? 'Bamako Centre' : undefined, guichet_name: String(row.fields.guichet) === '1' ? 'Hamdallaye' : undefined });
      }
    } else if (method !== 'GET') {
      row.fields = body.fields ? JSON.parse(body.fields) : row.fields;
      if (init.body instanceof FormData) for (const [key, file] of init.body) {
        if (!(file instanceof File) || !file.size) continue;
        const docKey = key.replace(/^documents\[|\]$/g, '');
        const doc = { id: store.nextId++, key: docKey, label: docKey, filename: file.name };
        await fileStore(`membership:${doc.id}`, file);
        row.documents = [...row.documents.filter((item: Row) => item.key !== docKey), doc];
      }
    }
    return commit({ data: row });
  }

  const activity = path.match(/^\/profile\/activities(?:\/(\d+))?$/);
  if (activity) {
    const id = Number(activity[1]);
    const rows = store.activities.filter(row => row.client_id === user.id);
    if (method === 'GET') return id ? response({ activity: rows.find(row => row.id === id) }) : collection(rows);
    if (method === 'POST') { const row = make({ client_id: user.id }); store.activities.push(row); return commit({ activity: row }); }
    const row = rows.find(item => item.id === id);
    if (!row) return failure('Activité introuvable.', 404);
    if (method === 'DELETE') store.activities = store.activities.filter(item => item !== row); else Object.assign(row, body);
    return commit({ activity: row });
  }
  const kyc = path.match(/^\/profile\/kyc-documents(?:\/(\d+))?$/);
  if (kyc) {
    const id = Number(kyc[1]);
    const rows = store.documents.filter(row => row.client_id === user.id && !row.credit_request_id);
    if (method === 'GET') return id ? response({ document: rows.find(row => row.id === id) }) : collection(rows);
    if (method === 'POST') {
      const row = make({ client_id: user.id, status: 'UPLOADED', uploaded_at: now() });
      await attachFile(row, init, `document:${row.id}`);
      if (!row.has_file) return failure('Sélectionnez une pièce.');
      store.documents.push(row); return commit({ document: row });
    }
    if (method === 'DELETE') { store.documents = store.documents.filter(row => !(row.id === id && row.client_id === user.id)); return commit({}); }
  }
  const file = path.match(/^\/(kyc-documents|documents|guarantees)\/(\d+)\/file$/);
  if (file) {
    const rows = file[1] === 'guarantees' ? store.guarantees : store.documents;
    const row = rows.find(row => row.id === Number(file[2]) && (staff || row.client_id === user.id));
    if (!row) return failure('Fichier introuvable.', 404);
    const blob = row.seeded ? new Blob(['Pièce fictive pour le parcours de démonstration.'], { type: 'text/plain' }) : await fileStore(`${file[1] === 'guarantees' ? 'guarantee' : 'document'}:${row.id}`);
    return blob ? new Response(blob, { headers: { 'Content-Type': blob.type } }) : failure('Fichier local indisponible.', 404);
  }
  if (path === '/agent/clients' && staff) return collection(store.profiles);
  const agentClient = path.match(/^\/agent\/clients\/(\d+)(?:\/(kyc))?$/);
  if (agentClient && staff) return response(agentClient[2] ? { kyc_documents: store.documents.filter(row => row.client_id === Number(agentClient[1]) && !row.credit_request_id) } : { client: store.profiles.find(row => row.id === Number(agentClient[1])) });
  const verifyIdentity = path.match(/^\/agent\/clients\/(\d+)\/kyc-documents\/(\d+)\/verify$/);
  if (verifyIdentity && ['admin', 'credit_agent'].includes(user.role) && method === 'POST') {
    const document = store.documents.find(row => row.id === Number(verifyIdentity[2]) && row.client_id === Number(verifyIdentity[1]));
    if (!document) return failure('Pièce introuvable.', 404);
    document.status = body.decision; return commit(document);
  }
  if (path === '/admin/users' && method === 'GET' && staff) return collection(store.users);
  if (['/admin/audit-logs', '/admin/scoring-models', '/roles', '/permissions'].includes(path) && method === 'GET') return collection([]);
  const loanPath = path.match(/^\/loans(?:\/(\d+))?(?:\/(disburse|repayments)(?:\/(\d+)\/record)?)?$/);
  if (loanPath) {
    const loans = store.requests.filter(row => staff || row.client_id === user.id).map(row => row.loan).filter(Boolean);
    if (!loanPath[1] && method === 'GET') return collection(loans);
    const loan = loans.find(row => row.id === Number(loanPath[1]));
    if (!loan) return failure('Prêt introuvable.', 404);
    if (method === 'GET') return loanPath[2] === 'repayments' ? collection(loan.repayments) : response({ loan });
    if (!['admin', 'credit_agent'].includes(user.role)) return failure('Action réservée à l’équipe.', 403);
    if (loanPath[2] === 'disburse' && method === 'POST') {
      if (loan.status !== 'APPROVED') return failure('Les fonds ont déjà été versés dans ce scénario.');
      Object.assign(loan, { status: 'ACTIVE', disbursed_at: body.disbursed_at || now(), funds_received: loan.principal_amount });
      return commit({ loan });
    }
    if (loanPath[3] && method === 'POST') {
      const repayment = loan.repayments.find((row: Row) => row.id === Number(loanPath[3]));
      const amount = Number(body.paid_amount);
      if (!repayment || !(amount > 0) || amount > repayment.remaining_amount || loan.status !== 'ACTIVE') return failure('Montant ou échéance invalide.');
      repayment.paid_amount += amount; repayment.remaining_amount -= amount;
      repayment.status = repayment.remaining_amount === 0 ? 'PAID' : 'PENDING';
      repayment.payment_date = body.payment_date || now();
      loan.outstanding_amount -= amount;
      if (loan.outstanding_amount <= 0) loan.status = 'CLOSED';
      return commit({ loan });
    }
  }

  const request = path.match(/^\/(credit-requests|agent\/requests|analyst\/requests|committee\/requests)(?:\/(\d+))?(?:\/(.*))?$/);
  if (request) {
    const [, scope, rawId, action] = request;
    if (scope !== 'credit-requests' && !staff) return failure('Espace équipe uniquement.', 403);
    const rows = store.requests.filter(row => staff || row.client_id === user.id);
    if (!rawId && method === 'GET') return collection(rows);
    if (!rawId && method === 'POST' && client) {
      const row = make({ client_id: user.id, client, status: 'DRAFT' });
      store.requests.push(row); return commit({ credit_request: row });
    }
    const row = rows.find(item => item.id === Number(rawId));
    if (!row) return failure('Dossier introuvable.', 404);
    if (!action) {
      if (method === 'PUT') Object.assign(row, body);
      if (method === 'DELETE') store.requests = store.requests.filter(item => item !== row);
      return commit({ credit_request: row });
    }
    const resource = action.match(/^(documents|guarantees)(?:\/(\d+))?$/);
    if (resource) {
      const guarantee = resource[1] === 'guarantees';
      const list = guarantee ? store.guarantees : store.documents;
      const items = list.filter(item => item.credit_request_id === row.id);
      const id = Number(resource[2]);
      if (method === 'GET') return id ? response(items.find(item => item.id === id) ?? {}) : collection(items);
      let item = items.find(item => item.id === id);
      if (method === 'POST') { item = make({ client_id: row.client_id, credit_request_id: row.id, status: 'UPLOADED', verification_status: 'PENDING' }); list.push(item); }
      if (!item) return failure('Pièce introuvable.', 404);
      if (method === 'DELETE') list.splice(list.indexOf(item), 1);
      else { Object.assign(item, body); await attachFile(item, init, `${guarantee ? 'guarantee' : 'document'}:${item.id}`); }
      return commit(item);
    }
    if (action === 'anomalies' && method === 'GET') return collection([]);
    if (action === 'analysis' && method === 'GET') return response({ analysis: row.analysis ?? null });
    if (action === 'field-visits' && staff) {
      if (method === 'GET') return collection(store.visits.filter(visit => visit.credit_request_id === row.id));
      if (method === 'POST') { const visit = make({ credit_request_id: row.id, status: 'SCHEDULED' }); store.visits.push(visit); return commit({ field_visit: visit }); }
    }
    if (method === 'POST') {
      if (action === 'score') {
        row.analysis = { id: row.id, overall_score: 75, confidence_score: 80, recommendation: 'RESERVED', analysis_summary: 'Exemple fictif pour tester le parcours. Aucun calcul de risque bancaire.', created_at: now() };
        return commit({ analysis: row.analysis });
      }
      if (action === 'human-validation' && ['analyst', 'admin'].includes(user.role)) {
        row.human_validation = body;
        const doc = store.documents.find(item => item.id === Number(body.document_id) && item.credit_request_id === row.id);
        if (doc) doc.status = body.decision;
        return commit({ credit_request: row });
      }
      const transitions: Record<string, string> = { submit: 'SUBMITTED', 'send-to-analysis': 'IN_ANALYSIS', 'request-complements': 'VERIFICATION_REQUIRED', review: body.next_step === 'COMMITTEE' ? 'PENDING_COMMITTEE' : 'VERIFICATION_REQUIRED', decide: body.decision };
      if (transitions[action]) {
        const roles: Record<string, string[]> = { submit: ['client'], 'send-to-analysis': ['credit_agent', 'admin'], 'request-complements': ['credit_agent', 'admin'], review: ['analyst', 'admin'], decide: ['committee_member', 'admin'] };
        if (!roles[action].includes(user.role)) return failure('Cette étape appartient à un autre rôle du parcours.', 403);
        const allowed: Record<string, string[]> = { submit: ['DRAFT', 'VERIFICATION_REQUIRED'], 'send-to-analysis': ['SUBMITTED', 'RECEIVED', 'UNDER_REVIEW'], 'request-complements': ['SUBMITTED', 'RECEIVED', 'UNDER_REVIEW'], review: ['IN_ANALYSIS', 'PENDING_ANALYSIS'], decide: ['PENDING_COMMITTEE', 'COMMITTEE'] };
        if (!allowed[action].includes(row.status)) return failure('Le dossier n’est pas à cette étape du parcours.');
        row.status = transitions[action];
        if (action === 'submit') row.submitted_at = now();
        if (action === 'review') row.analyst_review = body;
        if (action === 'decide') {
          Object.assign(row, { committee_decision: body, approved_amount: body.approved_amount, approved_duration_months: body.approved_duration_months });
          if (body.decision === 'APPROVED') {
            const amount = Number(body.approved_amount || row.requested_amount);
            const months = Math.max(1, Math.min(120, Number(body.approved_duration_months || row.duration_months)));
            const loanId = store.nextId++;
            row.loan = { id: loanId, credit_request_id: row.id, client_id: row.client_id, principal_amount: amount, total_amount: amount, outstanding_amount: amount, interest_amount: 0, duration_months: months, monthly_payment: amount / months, status: 'APPROVED', repayments: Array.from({ length: months }, (_, index) => {
              const due = new Date(); due.setMonth(due.getMonth() + index + 1);
              return { id: store.nextId++, loan_id: loanId, expected_amount: amount / months, remaining_amount: amount / months, paid_amount: 0, due_date: due.toISOString(), status: 'PENDING' };
            }) };
            row.loan_id = loanId;
          }
        }
        return commit({ credit_request: row });
      }
    }
  }
  const verify = path.match(/^\/agent\/guarantees\/(\d+)\/verify$/);
  if (verify && staff && method === 'POST') {
    const row = store.guarantees.find(item => item.id === Number(verify[1]));
    if (!row) return failure('Garantie introuvable.', 404);
    Object.assign(row, body, { verification_status: 'VERIFIED', verified_at: now() }); return commit(row);
  }
  const visitPath = path.match(/^\/agent\/field-visits(?:\/(\d+))?(?:\/(start|complete|cancel))?$/);
  if (visitPath && ['credit_agent', 'admin'].includes(user.role)) {
    if (!visitPath[1] && method === 'GET') return collection(store.visits.filter(visit => (!url.searchParams.get('status') || visit.status === url.searchParams.get('status')) && (!url.searchParams.get('credit_request_id') || visit.credit_request_id === Number(url.searchParams.get('credit_request_id')))));
    const visit = store.visits.find(item => item.id === Number(visitPath[1]));
    if (!visit) return failure('Visite introuvable.', 404);
    if (method === 'PUT') Object.assign(visit, body);
    if (method === 'POST') {
      const action = visitPath[2];
      if (['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(visit.status)) return failure('Cette visite est clôturée.');
      if (action === 'start') Object.assign(visit, { status: 'IN_PROGRESS', started_at: now() });
      if (action === 'complete') Object.assign(visit, body, { status: 'COMPLETED', completed_at: now() });
      if (action === 'cancel') Object.assign(visit, body, { status: body.as_no_show ? 'NO_SHOW' : 'CANCELLED', cancelled_at: now() });
    }
    return commit({ field_visit: visit });
  }
  return failure(`Étape locale à définir : ${method} ${path}. Aucun appel au backend n’a été effectué.`, 501);
}
