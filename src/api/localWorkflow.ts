/** Browser-only workflow prototype. No remote fallback and no real authentication. */
type Row = Record<string, any>;
type Store = { nextId: number; users: Row[]; profiles: Row[]; applications: Row[]; requests: Row[]; documents: Row[]; guarantees: Row[]; activities: Row[]; visits: Row[]; bankClients?: Row[]; routingVersion?: number; routingTurns?: Record<string, number> };
const agencies = [
  { code: 'BKO-HAM', network: 'CF-ML', city: 'Bamako', name: 'Hamdallaye', address: 'Accueil de l’agence Hamdallaye' },
  { code: 'BKO-KAL', network: 'CF-ML', city: 'Bamako', name: 'Kalabancoura', address: 'Accueil de l’agence Kalabancoura' },
  { code: 'BKO-FAL', network: 'CF-ML', city: 'Bamako', name: 'Faladié', address: 'Accueil de l’agence Faladié' },
  { code: 'SEG-CEN', network: 'CF-ML', city: 'Ségou', name: 'Ségou Centre', address: 'Accueil de l’agence Ségou Centre' },
];
const zones = [
  { code: 'HAM', name: 'Bamako — Hamdallaye', agency_code: 'BKO-HAM' },
  { code: 'KAL', name: 'Bamako — Kalabancoura', agency_code: 'BKO-KAL' },
  { code: 'FAL', name: 'Bamako — Faladié', agency_code: 'BKO-FAL' },
  { code: 'SEG', name: 'Ségou — Centre', agency_code: 'SEG-CEN' },
];
function ensureBranchTeams(store: Store) {
  const teams = [
    { agency: 'BKO-KAL', zone: 'KAL', slug: 'kalabancoura', label: 'Kalabancoura' },
    { agency: 'BKO-FAL', zone: 'FAL', slug: 'faladie', label: 'Faladié' },
  ];
  for (const team of teams) {
    for (const role of ['credit_agent', 'analyst', 'committee_member'] as const) {
      const prefix = role === 'credit_agent' ? 'agent' : role === 'committee_member' ? 'committee' : 'analyst';
      const email = `${prefix}.${team.slug}@demo.creditfast`;
      if (store.users.some(user => user.email === email)) continue;
      const title = role === 'credit_agent' ? 'Agent' : role === 'committee_member' ? 'Comité' : 'Analyste';
      store.users.push({ id: store.nextId++, full_name: `${title} ${team.label}`, email, role, status: 'active', agency_code: team.agency, zone_codes: [team.zone], available: true });
    }
  }
}
function ensureSegouClient(store: Store) {
  if (store.users.some(user => user.phone === '+22370000004')) return;
  const id = store.nextId++;
  const user = { id, full_name: 'Client Ségou', first_name: 'Démo', last_name: 'Ségou', phone: '+22370000004', email: null, role: 'client', status: 'active' };
  store.users.push(user);
  const accountId = store.nextId++;
  store.profiles.push({ id, user, client_number: `DEMO-${id}`, client_type: 'PHYSICAL_PERSON', city: 'Ségou', occupation: 'Commerce', kyc_status: 'VERIFIED', agency_code: 'SEG-CEN', residential_zone: 'SEG', financial_accounts: [{ id: accountId, account_number: 'DEMO-EP-SEGOU', account_type: 'EPARGNE', status: 'ACTIF', balance: 500000, agency_code: 'SEG-CEN' }], financial_profile: { monthly_income: 450000, monthly_expenses: 150000, existing_debt_payment: 0 } });
  store.documents.push({ id: store.nextId++, client_id: id, document_type: 'CNI', status: 'VERIFIED', original_filename: 'identite-fictive.txt', uploaded_at: now(), seeded: true });
}
function migrateRouting(store: Store) {
  if ((store.routingVersion || 0) < 1) {
  for (const member of store.users.filter(member => [4, 5, 6].includes(member.id))) {
    Object.assign(member, { agency_code: 'BKO-HAM', zone_codes: ['HAM'], available: true });
  }
  for (const profile of store.profiles.filter(profile => [1, 2, 3].includes(profile.id))) {
    profile.agency_code ??= 'BKO-HAM';
    profile.residential_zone ||= 'HAM';
    for (const account of profile.financial_accounts) account.agency_code ??= 'BKO-HAM';
  }
  for (const role of ['credit_agent', 'analyst', 'committee_member']) {
    const prefix = role === 'credit_agent' ? 'agent' : role === 'committee_member' ? 'committee' : 'analyst';
    store.users.push({ id: store.nextId++, full_name: `${prefix} Ségou`, email: `${prefix}.segou@demo.creditfast`, role, status: 'active', agency_code: 'SEG-CEN', zone_codes: ['SEG'], available: true });
  }
  for (const row of store.requests.filter(row => row.status !== 'DRAFT')) {
    const owner = store.profiles.find(profile => profile.id === row.client_id);
    Object.assign(row, { agency_code: owner?.agency_code || null, zone_code: owner?.residential_zone || null, assignment_status: 'PENDING', assignment_reason: 'Dossier antérieur : affectation à confirmer', assignment_history: [] });
  }
  store.routingVersion = 1;
  save(store);
  }
  if ((store.routingVersion || 0) < 2) {
    ensureBranchTeams(store);
    ensureSegouClient(store);
    store.routingVersion = 2;
    save(store);
  }
}
function routeRequest(store: Store, row: Row, owner: Row) {
  if (row.assignment_status) return;
  const accounts = owner.financial_accounts.filter((account: Row) => ['EPARGNE', 'SAVINGS'].includes(account.account_type) && ['ACTIVE', 'ACTIF'].includes(account.status));
  const account = row.financial_account_id ? accounts.find((account: Row) => account.id === Number(row.financial_account_id)) : accounts.length === 1 ? accounts[0] : undefined;
  if (!account) throw new Error('Choisissez un compte épargne actif dans les paramètres de prise en charge.');
  const agency = agencies.find(agency => agency.code === account.agency_code);
  if (!agency || (owner.agency_code && owner.agency_code !== agency.code)) throw new Error('Le rattachement à l’agence doit être corrigé avant la soumission.');
  const zone = zones.find(zone => zone.code === owner.residential_zone);
  if (!zone || zone.agency_code !== agency.code) throw new Error('La zone choisie doit appartenir à l’agence du compte épargne. Corrigez la zone, ou faites corriger le rattachement en agence.');
  Object.assign(row, { financial_account_id: account.id, agency_code: agency.code, agency_name: `${agency.city} — ${agency.name}`, zone_code: zone.code, assignment_status: 'PENDING', assignment_reason: 'Aucun agent disponible pour cette zone', assigned_agent_id: null, assignment_history: [] });
  const eligible = store.users.filter(member => member.role === 'credit_agent' && member.status === 'active' && member.available === true && member.agency_code === agency.code && member.zone_codes?.includes(zone.code)).sort((a, b) => a.id - b.id);
  if (!eligible.length) return;
  const key = `${agency.code}:${zone.code}`;
  store.routingTurns ??= {};
  const last = store.routingTurns[key] || 0;
  const agent = eligible.find(agent => agent.id > last) || eligible[0];
  store.routingTurns[key] = agent.id;
  Object.assign(row, { assigned_agent_id: agent.id, assigned_agent_name: agent.full_name, assignment_status: 'ASSIGNED', assignment_reason: null });
  row.assignment_history.push({ at: now(), actor_id: owner.id, from_agent_id: null, to_agent_id: agent.id, reason: 'Affectation automatique à la soumission' });
}
export function resolveBankIdentity(identity: Row | undefined, bankClients: Row[], hints: Row = {}) {
  const keys = ['type', 'country', 'issuer', 'number'];
  const normalized = (value: unknown) => String(value ?? '').trim().toUpperCase();
  if (!identity?.verified || keys.some(key => !normalized(identity[key]))) return { status: 'REVIEW_REQUIRED' };
  const matches = bankClients.filter(candidate => candidate.identity?.verified && keys.every(key => normalized(candidate.identity[key]) === normalized(identity[key])));
  if (matches.length > 1) return { status: 'REVIEW_REQUIRED' };
  if (!matches.length) return { status: 'NOT_FOUND' };
  const candidate = matches[0];
  const accounts = (candidate.accounts ?? []).filter((account: Row) => ['EPARGNE', 'SAVINGS'].includes(normalized(account.account_type)));
  const suppliedHints = Object.entries(hints).filter(([, value]) => value);
  if (suppliedHints.length && !accounts.some((account: Row) => suppliedHints.every(([key, value]) => normalized(account[key]) === normalized(value)))) return { status: 'REVIEW_REQUIRED' };
  return { status: accounts.length ? 'MATCHED' : 'NOT_FOUND', client: candidate, accounts };
}
const KEY = 'creditfast:local-workflow:v1';
const now = () => new Date().toISOString();
const response = (data: unknown, status = 200) => Response.json(data, { status });
const failure = (message: string, status = 422) => response({ message }, status);
function dossierHolder(status) {
  const key = String(status || '').toUpperCase();
  if (['SUBMITTED', 'RECEIVED', 'UNDER_REVIEW', 'VERIFICATION_REQUIRED'].includes(key)) return 'agent';
  if (['IN_ANALYSIS', 'PENDING_ANALYSIS', 'ANALYSIS', 'CREDIT_REVIEW'].includes(key)) return 'analyst';
  if (['PENDING_COMMITTEE', 'COMMITTEE'].includes(key)) return 'committee';
  if (['APPROVED', 'AMENDED', 'REJECTED'].includes(key)) return 'closed';
  if (key === 'ADJOURNED') return 'client';
  return 'client';
}
function stageLockMessage(status, actor) {
  if (String(status || '').toUpperCase() === 'ADJOURNED') return 'Ce dossier est ajourné. Le vote est verrouillé.';
  const holder = dossierHolder(status);
  if (holder === actor) return null;
  if (holder === 'closed') return 'Ce dossier est clos. Cette étape est verrouillée.';
  if (holder === 'client') return 'Le demandeur n’a pas encore envoyé ce dossier.';
  const names = { agent: 'l’agent', analyst: 'l’analyste', committee: 'le comité', client: 'le demandeur' };
  return `Ce dossier est chez ${names[holder]}. Les actions de ${names[actor] || 'cette étape'} sont verrouillées.`;
}
const ANNUAL_INTEREST_RATE = 15;
function loanQuote(amount: number, months: number, rate = ANNUAL_INTEREST_RATE) {
  const span = Math.max(1, months);
  const interest = Math.round(amount * (rate / 100) * (span / 12));
  const total = amount + interest;
  const monthly = Math.round(total / span);
  return { interest, total, monthly };
}
function scoreArrival(store: Store, row: Row) {
  const profile = store.profiles.find(item => item.id === row.client_id) || {};
  const finances = profile.financial_profile || {};
  const income = Number(row.declared_monthly_income ?? finances.monthly_income ?? 0);
  const expenses = Number(row.declared_monthly_expenses ?? finances.monthly_expenses ?? 0);
  const debt = store.requests.filter(item => item.client_id === row.client_id && item.id !== row.id && item.loan && ['ACTIVE', 'APPROVED'].includes(item.loan.status)).reduce((sum, item) => sum + (Math.round(Number(item.loan.monthly_payment)) || 0), 0);
  const amount = Number(row.requested_amount || 0);
  const months = Math.max(1, Number(row.duration_months || 12));
  const disposable = income - expenses - debt;
  const quote = loanQuote(amount, months);
  const coverage = quote.monthly > 0 ? disposable / quote.monthly : 0;
  let capacity = 20;
  if (coverage >= 1.8) capacity = 95;
  else if (coverage >= 1.4) capacity = 85;
  else if (coverage >= 1.15) capacity = 70;
  else if (coverage >= 0.9) capacity = 45;
  const accounts = (profile.financial_accounts || []).filter((account: Row) => ['EPARGNE', 'SAVINGS'].includes(account.account_type) && ['ACTIF', 'ACTIVE'].includes(account.status));
  const balance = accounts.reduce((sum: number, account: Row) => sum + Number(account.balance || 0), 0);
  let savings = 40;
  if (balance >= 1000000) savings = 90;
  else if (balance >= 400000) savings = 75;
  else if (balance > 0) savings = 60;
  const activity = (store.activities || []).find((item: Row) => item.client_id === row.client_id);
  const started = activity?.start_date ? new Date(activity.start_date).getFullYear() : NaN;
  const years = Number(row.activity_seniority_years ?? activity?.years_active ?? (Number.isFinite(started) ? new Date().getFullYear() - started : 0));
  const stability = years > 0 ? Math.min(95, Math.round(years * 15)) : 55;
  const guarantees = (store.guarantees || []).filter((item: Row) => item.credit_request_id === row.id);
  const cover = guarantees.reduce((sum: number, item: Row) => sum + Number(item.verified_value ?? item.declared_value ?? 0), 0);
  const guarantee = cover > 0 && amount > 0 ? (cover / amount >= 1.2 ? 95 : cover / amount >= 0.8 ? 80 : 65) : 35;
  const docs = (store.documents || []).filter((item: Row) => item.credit_request_id === row.id);
  const verifiedDocs = docs.filter((item: Row) => ['VERIFIED', 'VALIDATED', 'CONFORME', 'APPROVED', 'ACCEPTED'].includes(String(item.status || '').toUpperCase()));
  const documents = docs.length ? (verifiedDocs.length === docs.length ? 90 : 55) : 50;
  const zoneScore = profile.residential_zone || profile.city ? 75 : 60;
  const prior = store.requests.filter(item => item.client_id === row.client_id && item.id !== row.id && item.loan);
  let history = 70;
  let late = 0;
  let tracked = 0;
  const today = Date.now();
  for (const item of prior) {
    for (const repayment of item.loan.repayments || []) {
      const due = new Date(repayment.due_date).getTime();
      if (!Number.isFinite(due)) continue;
      const paid = String(repayment.status || '').toUpperCase() === 'PAID' || Number(repayment.remaining_amount) === 0;
      const paidAt = repayment.payment_date ? new Date(repayment.payment_date).getTime() : NaN;
      if (paid) {
        tracked += 1;
        if (Number.isFinite(paidAt) && paidAt > due) late += 1;
      } else if (due < today) {
        tracked += 1;
        late += 1;
      }
    }
  }
  if (prior.length) history = late === 0 ? 95 : Math.max(20, 95 - late * 30);
  const overall = Math.max(0, Math.min(100, Math.round(capacity * 0.25 + history * 0.2 + savings * 0.15 + stability * 0.15 + guarantee * 0.1 + documents * 0.1 + zoneScore * 0.05)));
  const recommendation = overall >= 75 ? 'FAVORABLE' : overall >= 50 ? 'RESERVED' : 'UNFAVORABLE';
  let confidence = 90;
  if (!(income > 0)) confidence -= 15;
  if (!accounts.length) confidence -= 10;
  if (!guarantees.length) confidence -= 10;
  if (profile.kyc_status !== 'VERIFIED') confidence -= 15;
  if (!docs.length) confidence -= 5;
  confidence = Math.max(45, Math.min(99, confidence));
  const historyText = prior.length ? `Échéances précédentes : ${tracked - late} à temps, ${late} en retard.` : 'Pas encore d’échéancier antérieur.';
  return {
    id: row.id,
    overall_score: overall,
    confidence_score: confidence,
    recommendation,
    repayment_capacity_score: capacity,
    credit_history_score: history,
    savings_score: savings,
    activity_score: stability,
    guarantee_score: guarantee,
    document_score: documents,
    analysis_summary: `Capacité ${capacity}/100, reste à vivre ${disposable} FCFA, échéance ${quote.monthly} FCFA au taux de ${ANNUAL_INTEREST_RATE} %. ${historyText} Épargne ${savings}/100, activité ${stability}/100, garantie ${guarantee}/100.`,
    created_at: now(),
  };
}
function activeSavingsAccount(profile: Row | undefined) {
  return (profile?.financial_accounts || []).find((account: Row) => ['EPARGNE', 'SAVINGS'].includes(account.account_type) && ['ACTIF', 'ACTIVE'].includes(account.status));
}
function accountFigures(store: Store, clientId: number) {
  const finances = store.profiles.find(row => row.id === clientId)?.financial_profile ?? {};
  const ongoing = store.requests.filter(row => row.client_id === clientId && row.loan && ['ACTIVE', 'APPROVED'].includes(row.loan.status)).length;
  return { declared_monthly_income: Number(finances.monthly_income) || 0, declared_monthly_expenses: Number(finances.monthly_expenses) || 0, ongoing_credit_count: ongoing };
}
const collection = (data: Row[]) => response({ data, current_page: 1, last_page: 1, total: data.length });
export const DEMO_ACCOUNTS = [
  { label: 'Client avec épargne', identifier: '+22370000001' },
  { label: 'Client sans épargne', identifier: '+22370000002' },
  { label: 'Profil à compléter', identifier: '+22370000003' },
  { label: 'Agent', identifier: 'agent@demo.creditfast' },
  { label: 'Analyste', identifier: 'analyst@demo.creditfast' },
  { label: 'Comité', identifier: 'committee@demo.creditfast' },
  { label: 'Administrateur', identifier: 'admin@demo.creditfast' },
  { label: 'Agent Ségou', identifier: 'agent.segou@demo.creditfast' },
  { label: 'Analyste Ségou', identifier: 'analyst.segou@demo.creditfast' },
  { label: 'Comité Ségou', identifier: 'committee.segou@demo.creditfast' },
  { label: 'Client Ségou', identifier: '+22370000004' },
  { label: 'Agent Kalabancoura', identifier: 'agent.kalabancoura@demo.creditfast' },
  { label: 'Analyste Kalabancoura', identifier: 'analyst.kalabancoura@demo.creditfast' },
  { label: 'Comité Kalabancoura', identifier: 'committee.kalabancoura@demo.creditfast' },
  { label: 'Agent Faladié', identifier: 'agent.faladie@demo.creditfast' },
  { label: 'Analyste Faladié', identifier: 'analyst.faladie@demo.creditfast' },
  { label: 'Comité Faladié', identifier: 'committee.faladie@demo.creditfast' },
];
function seed(): Store {
  const users = DEMO_ACCOUNTS.slice(0, 7).map((entry, i) => ({ id: i + 1, full_name: entry.label, first_name: 'Démo', last_name: entry.label, phone: i < 3 ? entry.identifier : null, email: i >= 3 ? entry.identifier : null, role: ['client', 'client', 'client', 'credit_agent', 'analyst', 'committee_member', 'admin'][i], status: 'active' }));
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
  migrateRouting(store);
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
  const canReadRequest = (row: Row) => user.role === 'admin' || (user.role === 'client' ? row.client_id === user.id : Boolean(user.agency_code && row.agency_code === user.agency_code && row.status !== 'DRAFT' && (user.role !== 'credit_agent' || row.assigned_agent_id === user.id)));
  const canReadClient = (id: number) => user.role === 'admin' || id === user.id || store.requests.some(row => row.client_id === id && canReadRequest(row));
  if (path === '/routing/catalog' && method === 'GET') return response({ agencies, zones, agents: user.role === 'admin' ? store.users.filter(member => member.role === 'credit_agent') : [] });
  const coverage = path.match(/^\/routing\/agents\/(\d+)$/);
  if (coverage && method === 'PUT') {
    if (user.role !== 'admin') return failure('Paramétrage réservé au responsable.', 403);
    const agent = store.users.find(member => member.id === Number(coverage[1]) && member.role === 'credit_agent');
    const requestedZones = Array.isArray(body.zone_codes) ? body.zone_codes : [];
    if (!agent || !agencies.some(agency => agency.code === body.agency_code) || requestedZones.some(code => !zones.some(zone => zone.code === code && zone.agency_code === body.agency_code)) || typeof body.available !== 'boolean') return failure('Agence ou zones invalides.');
    Object.assign(agent, { agency_code: body.agency_code, zone_codes: requestedZones, available: body.available });
    return commit({ agent });
  }
  if (path === '/routing/requests' && user.role === 'admin' && method === 'GET') return collection(store.requests.filter(row => row.status !== 'DRAFT'));
  const assign = path.match(/^\/routing\/requests\/(\d+)\/assign$/);
  if (assign && method === 'POST') {
    if (user.role !== 'admin') return failure('Affectation réservée au responsable.', 403);
    const row = store.requests.find(row => row.id === Number(assign[1]));
    const agent = store.users.find(member => member.id === Number(body.agent_id) && member.role === 'credit_agent' && member.status === 'active' && member.available === true);
    if (!row || !['SUBMITTED', 'RECEIVED', 'UNDER_REVIEW', 'VERIFICATION_REQUIRED'].includes(row.status)) return failure('Ce dossier ne peut pas être réaffecté à cette étape.');
    if (!agent || agent.agency_code !== row.agency_code || !String(body.reason || '').trim()) return failure('Choisissez un agent disponible de cette agence et indiquez un motif.');
    row.assignment_history ??= [];
    row.assignment_history.push({ at: now(), actor_id: user.id, from_agent_id: row.assigned_agent_id, to_agent_id: agent.id, reason: body.reason });
    Object.assign(row, { assigned_agent_id: agent.id, assigned_agent_name: agent.full_name, assignment_status: 'ASSIGNED', assignment_reason: null });
    return commit({ credit_request: row });
  }
  if (path === '/auth/me') return response({ user });
  if (path === '/profile/savings-onboarding' || path === '/profile/savings-pre-applications') {
    if (!client) return failure('Profil client introuvable.', 404);
    if (!store.bankClients) store.bankClients = store.profiles.filter(profile => [1, 3].includes(profile.id)).map(profile => ({ id: `BANK-${profile.id}`, identity: { type: 'CNI', country: 'ML', issuer: 'ETAT-ML', number: `IDENTITE-FICTIVE-${profile.id}`, verified: true }, accounts: profile.financial_accounts.map((account: Row) => ({ ...account, network_code: 'CF-ML', agency_code: 'BKO-HAM' })) }));
    if ([1, 2, 3].includes(client.id) && !client.banking_identity) client.banking_identity = { type: 'CNI', country: 'ML', issuer: 'ETAT-ML', number: `IDENTITE-FICTIVE-${client.id}`, verified: true };
    for (const profile of store.profiles) if ([1, 3].includes(profile.id) && !profile.bank_client_id) profile.bank_client_id = `BANK-${profile.id}`;
    const result = resolveBankIdentity(client.banking_identity, store.bankClients, client.bank_lookup_hints);
    if (result.status === 'MATCHED' && result.client) {
      const claimed = store.profiles.some(profile => profile.id !== client.id && profile.bank_client_id === result.client.id);
      if (claimed) result.status = 'REVIEW_REQUIRED';
      else { client.bank_client_id = result.client.id; if (!client.financial_accounts.length) client.financial_accounts = result.accounts; }
    }
    const savings = client.financial_accounts.filter((account: Row) => ['EPARGNE', 'SAVINGS'].includes(account.account_type));
    const status = savings.length ? (savings.some((account: Row) => ['ACTIF', 'ACTIVE'].includes(account.status)) ? 'MATCHED' : 'INACTIVE') : result.status;
    const current = [...store.applications].reverse().find(application => application.client_id === user.id && application.status !== 'REJECTED') ?? null;
    if (path === '/profile/savings-onboarding' && method === 'GET') return commit({ status, application: current, agencies });
    if (path === '/profile/savings-pre-applications' && method === 'POST') {
      if (status === 'MATCHED' || status === 'INACTIVE') return failure('Un compte est déjà rattaché à votre profil.');
      if (current && ['PENDING', 'APPROVED'].includes(current.status)) return failure('Une demande est déjà en cours. Consultez son suivi.');
      const agency = agencies.find(item => item.code === body.agency_code);
      if (!agency || !String(body.full_name ?? '').trim() || !String(body.phone ?? '').trim() || !String(body.city ?? '').trim()) return failure('Renseignez votre identité, téléphone, ville et agence.');
      const application = current?.status === 'CHANGES_REQUESTED' ? current : make({ client_id: user.id, client_type: client.client_type || 'PHYSICAL_PERSON', documents: [] });
      Object.assign(application, { applicant_name: String(body.full_name).trim(), status: 'PENDING', kind: 'PRE_APPLICATION', fields: { full_name: String(body.full_name).trim(), phone: String(body.phone).trim(), city: String(body.city).trim(), agency_code: agency.code, agency_name: `${agency.city} — ${agency.name}`, network_code: agency.network, purpose: status === 'REVIEW_REQUIRED' || body.existing_account === 'yes' ? 'IDENTITY_REVIEW' : 'ACCOUNT_OPENING', account_number_hint: String(body.account_number_hint || '').trim() }, correction_reason: undefined, reference: `PRE-${application.id}`, created_at: application.created_at || now() });
      if (!store.applications.includes(application)) store.applications.push(application);
      return commit(application);
    }
    return failure('Action indisponible.', 405);
  }
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
    if (method === 'PUT') { for (const key of ['date_of_birth', 'address', 'city', 'residential_zone', 'occupation']) if (key in body) client[key] = body[key]; return commit({ client }); }
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
  if (path === '/profile/account-check' && method === 'GET' && client) {
    const figures = accountFigures(store, client.id);
    return response({ monthly_income: figures.declared_monthly_income, monthly_expenses: figures.declared_monthly_expenses, ongoing_credit_count: figures.ongoing_credit_count });
  }
  if (path === '/profile/financial-profile' && client) {
    if (method === 'GET') return response({ financial_profile: client.financial_profile ?? {} });
    client.financial_profile = body; return commit({ financial_profile: body });
  }
  if (path === '/caisses') return collection([{ id: 1, name: 'Bamako Centre' }]);
  if (/^\/caisses\/\d+\/guichets$/.test(path)) return collection([{ id: 1, name: 'Hamdallaye' }]);
  if (path === '/notifications') return collection([]);
  if (path === '/credit-products') return collection([{ credit_type: 'PROFESSIONAL_WORKING_CAPITAL', label: 'Fonds de roulement', min_amount: 50000, max_amount: 10000000, min_duration_months: 3, max_duration_months: 36 }, { credit_type: 'CONSUMER_PERSONAL', label: 'Prêt personnel', min_amount: 50000, max_amount: 5000000, min_duration_months: 3, max_duration_months: 36 }]);
  if (path === '/simulations/installments' && method === 'POST') return response({ scenarios: (body.scenarios ?? []).map((scenario: Row) => { const quote = loanQuote(Number(scenario.requested_amount) || 0, Number(scenario.duration_months) || 1); return { ...scenario, monthly_payment: quote.monthly, total_interest: quote.interest, total_amount: quote.total, interest_rate: ANNUAL_INTEREST_RATE, repayment_capacity_status: 'DEMO' }; }) });

  const membership = path.match(/^\/(agent\/)?bank-account-applications\/(physical-person|legal-entity)(?:\/(\d+))?(?:\/(submit|approve|reject|return|verify-identity))?$/);
  if (membership) {
    const [, agent, kind, rawId, action] = membership;
    if (agent && !staff) return failure('Espace équipe uniquement.', 403);
    const type = kind === 'legal-entity' ? 'LEGAL_ENTITY' : 'PHYSICAL_PERSON';
    const rows = store.applications.filter(row => row.client_type === type && (user.role === 'admin' || (staff ? Boolean(user.agency_code && (row.fields.agency_code || store.profiles.find(profile => profile.id === row.client_id)?.agency_code) === user.agency_code) : row.client_id === user.id)));
    if (!rawId && method === 'GET') return collection(rows.filter(row => !url.searchParams.get('status') || row.status === url.searchParams.get('status')));
    let row = rows.find(item => item.id === Number(rawId));
    if (!rawId && method === 'POST') {
      row = make({ client_id: user.id, client_type: type, applicant_name: user.full_name, status: 'DRAFT', fields: {}, documents: [] });
      store.applications.push(row);
    }
    if (!row) return failure('Demande d’ouverture introuvable.', 404);
    if (action) {
      if (action !== 'submit' && !['admin', 'credit_agent'].includes(user.role)) return failure('Validation réservée à l’équipe.', 403);
      if (action === 'verify-identity') {
        if (row.status !== 'PENDING' || !body.agency_finalized) return failure('Confirmez le contrôle de l’identité en agence sur une demande en attente.');
        const owner = store.profiles.find(profile => profile.id === row!.client_id);
        if (!owner) return failure('Client introuvable.', 404);
        const identity = { type: body.identity_type, country: body.identity_country, issuer: body.identity_issuer, number: body.identity_number, verified: true };
        const hints = row.fields.account_number_hint ? { account_number: row.fields.account_number_hint, agency_code: row.fields.agency_code, network_code: row.fields.network_code } : {};
        const match = resolveBankIdentity(identity, store.bankClients ?? [], hints);
        if (match.status === 'REVIEW_REQUIRED') return failure('Identité incomplète, correspondance multiple ou références contradictoires. Une investigation en agence est nécessaire.');
        if (match.client && store.profiles.some(profile => profile.id !== owner.id && profile.bank_client_id === match.client.id)) return failure('Ce client bancaire est déjà rattaché à un autre accès. Vérifiez les doublons.');
        owner.banking_identity = identity;
        row.fields.identity_checked_by = user.full_name;
        if (match.client && match.accounts?.length) {
          owner.bank_client_id = match.client.id;
          owner.financial_accounts = match.accounts;
          row.status = 'APPROVED'; row.fields.purpose = 'ACCOUNT_LINKED';
        } else if (row.fields.account_number_hint) {
          return failure('Le compte déclaré n’a pas été retrouvé. Confirmez ses références avant toute nouvelle ouverture.');
        } else row.fields.purpose = 'ACCOUNT_OPENING';
        return commit({ data: row });
      }
      if (action === 'approve' && row.kind === 'PRE_APPLICATION') {
        if (row.status !== 'PENDING') return failure('Cette demande n’est plus en attente.');
        if (row.fields.purpose === 'IDENTITY_REVIEW') return failure('Le rapprochement d’identité doit être confirmé avant toute ouverture de compte.');
        const owner = store.profiles.find(profile => profile.id === row!.client_id);
        if (resolveBankIdentity(owner?.banking_identity, store.bankClients ?? []).status !== 'NOT_FOUND') return failure('Revérifiez le rattachement bancaire avant de créer un compte.');
        if ((store.bankClients ?? []).some(bank => bank.accounts.some((account: Row) => account.network_code === row!.fields.network_code && account.agency_code === row!.fields.agency_code && account.account_number === body.account_number))) return failure('Ce numéro de compte existe déjà dans cette agence.');
        if (!body.agency_finalized || !String(body.account_number || '').trim() || !String(body.caisse_signature || '').trim()) return failure('Confirmez la finalisation en agence, le numéro de compte et le responsable.');
      }
      row.status = ({ submit: 'PENDING', approve: 'APPROVED', reject: 'REJECTED', return: 'CHANGES_REQUESTED' } as Row)[action];
      row.correction_reason = action === 'return' ? body.reason : undefined;
      row.rejection_reason = action === 'reject' ? body.reason : undefined;
      if (action === 'approve') {
        const owner = store.profiles.find(profile => profile.id === row!.client_id);
        if (owner && !owner.financial_accounts.length) owner.financial_accounts.push({ id: store.nextId++, account_number: body.account_number || `DEMO-EP-${owner.id}`, account_type: 'EPARGNE', status: 'ACTIF', balance: 0, opened_at: now(), network_code: row.fields.network_code, agency_code: row.fields.agency_code, caisse_name: row.fields.agency_name || (String(row.fields.caisse) === '1' ? 'Bamako Centre' : undefined), guichet_name: agencies.find(item => item.code === row.fields.agency_code)?.name || (String(row.fields.guichet) === '1' ? 'Hamdallaye' : undefined) });
        if (owner && row.kind !== 'PRE_APPLICATION' && String(row.fields.caisse) === '1') {
          for (const account of owner.financial_accounts) account.agency_code ??= 'BKO-HAM';
        }
        if (owner && row.kind === 'PRE_APPLICATION') {
          owner.agency_code = row.fields.agency_code;
          owner.bank_client_id = `BANK-${owner.id}`;
          (store.bankClients ??= []).push({ id: owner.bank_client_id, identity: owner.banking_identity, accounts: owner.financial_accounts });
        }
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
    const row = rows.find(row => row.id === Number(file[2]) && (row.credit_request_id ? store.requests.some(request => request.id === row.credit_request_id && canReadRequest(request)) : canReadClient(row.client_id)));
    if (!row) return failure('Fichier introuvable.', 404);
    const blob = row.seeded ? new Blob(['Pièce fictive pour le parcours de démonstration.'], { type: 'text/plain' }) : await fileStore(`${file[1] === 'guarantees' ? 'guarantee' : 'document'}:${row.id}`);
    return blob ? new Response(blob, { headers: { 'Content-Type': blob.type } }) : failure('Fichier local indisponible.', 404);
  }
  if (path === '/agent/clients' && staff) return collection(store.profiles.filter(profile => canReadClient(profile.id)));
  const agentClient = path.match(/^\/agent\/clients\/(\d+)(?:\/(kyc))?$/);
  if (agentClient && staff) {
    if (!canReadClient(Number(agentClient[1]))) return failure('Client introuvable.', 404);
    return response(agentClient[2] ? { kyc_documents: store.documents.filter(row => row.client_id === Number(agentClient[1]) && !row.credit_request_id) } : { client: store.profiles.find(row => row.id === Number(agentClient[1])) });
  }
  const verifyIdentity = path.match(/^\/agent\/clients\/(\d+)\/kyc-documents\/(\d+)\/verify$/);
  if (verifyIdentity && ['admin', 'credit_agent'].includes(user.role) && method === 'POST') {
    if (!canReadClient(Number(verifyIdentity[1]))) return failure('Client introuvable.', 404);
    const document = store.documents.find(row => row.id === Number(verifyIdentity[2]) && row.client_id === Number(verifyIdentity[1]));
    if (!document) return failure('Pièce introuvable.', 404);
    document.status = body.decision; return commit(document);
  }
  if (path === '/admin/users' && method === 'GET' && staff) return collection(store.users);
  if (['/admin/audit-logs', '/admin/scoring-models', '/roles', '/permissions'].includes(path) && method === 'GET') return collection([]);
  const loanPath = path.match(/^\/loans(?:\/(\d+))?(?:\/(disburse|repayments)(?:\/(\d+)\/record)?)?$/);
  if (loanPath) {
    const loans = store.requests.filter(canReadRequest).map(row => row.loan).filter(Boolean);
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
    const rows = store.requests.filter(canReadRequest);
    if (!rawId && method === 'GET') return collection(rows);
    if (!rawId && method === 'POST' && client) {
      const row = make({ client_id: user.id, client, status: 'DRAFT', agency_code: null, assigned_agent_id: null, assignment_status: null, ...accountFigures(store, user.id) });
      delete row.existing_debt_payment;
      store.requests.push(row); return commit({ credit_request: row });
    }
    const row = rows.find(item => item.id === Number(rawId));
    if (!row) return failure('Dossier introuvable.', 404);
    if (!action) {
      if (method === 'PUT' || method === 'DELETE') {
        if (row.client_id !== user.id || !['DRAFT', 'VERIFICATION_REQUIRED'].includes(row.status)) return failure('Ce dossier ne peut pas être modifié à cette étape.', 403);
        if (method === 'PUT') {
          const protectedFields = ['id', 'client_id', 'client', 'status', 'agency_code', 'agency_name', 'zone_code', 'assigned_agent_id', 'assigned_agent_name', 'assignment_status', 'assignment_reason', 'assignment_history', 'loan', 'loan_id'];
          for (const [key, value] of Object.entries(body)) if (!protectedFields.includes(key) && !(key === 'financial_account_id' && row.assignment_status)) row[key] = value;
          Object.assign(row, accountFigures(store, row.client_id));
          delete row.existing_debt_payment;
        }
        if (method === 'DELETE') store.requests = store.requests.filter(item => item !== row);
      }
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
    if (action === 'analysis' && method === 'GET') {
      if (!['committee_member', 'admin'].includes(user.role)) return failure('Le score est réservé au comité.', 403);
      return response({ analysis: row.analysis ?? null });
    }
    if (action === 'field-visits' && staff) {
      if (method === 'GET') return collection(store.visits.filter(visit => visit.credit_request_id === row.id));
      if (method === 'POST') { const visit = make({ credit_request_id: row.id, status: 'SCHEDULED' }); store.visits.push(visit); return commit({ field_visit: visit }); }
    }
    if (method === 'POST') {
      if (action === 'score') {
        if (!['committee_member', 'admin'].includes(user.role) || !['PENDING_COMMITTEE', 'COMMITTEE'].includes(row.status)) return failure('Le score est calculé à l’arrivée du dossier au comité et n’est visible que par le comité.', 403);
        row.analysis = row.analysis || scoreArrival(store, row);
        return commit({ analysis: row.analysis });
      }
      if (action === 'human-validation') {
        if (!['analyst', 'admin'].includes(user.role)) return failure('Cette validation appartient à l’analyste tant que le dossier est en analyse.', 403);
        const locked = stageLockMessage(row.status, 'analyst');
        if (locked) return failure(locked, 403);
        row.human_validation = body;
        const doc = store.documents.find(item => item.id === Number(body.document_id) && item.credit_request_id === row.id);
        if (doc && ['VALIDATED', 'VERIFIED', 'APPROVED', 'CONFORME', 'ACCEPTED'].includes(String(doc.status || '').toUpperCase())) {
          return failure('Cette pièce est conforme. Le contrôle est verrouillé.', 403);
        }
        if (doc) doc.status = body.decision;
        return commit({ credit_request: row });
      }
      const transitions: Record<string, string> = { submit: 'SUBMITTED', 'send-to-analysis': 'IN_ANALYSIS', 'request-complements': 'VERIFICATION_REQUIRED', review: body.next_step === 'COMMITTEE' ? 'PENDING_COMMITTEE' : 'VERIFICATION_REQUIRED', decide: body.decision };
      if (transitions[action]) {
        const roles: Record<string, string[]> = { submit: ['client'], 'send-to-analysis': ['credit_agent', 'admin'], 'request-complements': ['credit_agent', 'admin'], review: ['analyst', 'admin'], decide: ['committee_member', 'admin'] };
        if (!roles[action].includes(user.role)) return failure('Cette étape appartient à un autre rôle du parcours.', 403);
        if (action === 'submit' && row.status === 'SUBMITTED') return response({ credit_request: row });
        if (action !== 'submit' && row.assignment_status !== 'ASSIGNED') return failure('Le responsable doit affecter ce dossier avant son traitement.');
        const allowed: Record<string, string[]> = { submit: ['DRAFT', 'VERIFICATION_REQUIRED'], 'send-to-analysis': ['SUBMITTED', 'RECEIVED', 'UNDER_REVIEW'], 'request-complements': ['SUBMITTED', 'RECEIVED', 'UNDER_REVIEW', 'VERIFICATION_REQUIRED'], review: ['IN_ANALYSIS', 'PENDING_ANALYSIS'], decide: ['PENDING_COMMITTEE', 'COMMITTEE'] };
        if (!allowed[action].includes(row.status)) {
          const actor = action === 'decide' ? 'committee' : action === 'review' ? 'analyst' : action === 'submit' ? 'client' : 'agent';
          if (action === 'send-to-analysis' && row.status === 'VERIFICATION_REQUIRED') return failure('Le demandeur doit d’abord répondre au complément.');
          return failure(stageLockMessage(row.status, actor) || 'Le dossier n’est pas à cette étape du parcours.', 403);
        }
        const asksComplement = action === 'request-complements' || (action === 'review' && body.next_step !== 'COMMITTEE');
        const complementDetail = String(body.detail || '').trim();
        const committeeWhy = String(body.reason || '').trim();
        const committeeWhat = String(body.what || '').trim();
        const committeeReturn = action === 'decide' && ['ADJOURNED', 'VERIFICATION_REQUIRED'].includes(body.decision);
        if (asksComplement && (!['PIECE', 'INFORMATION', 'FIELD_VISIT', 'GUARANTEE'].includes(body.subject) || complementDetail.length < 5)) return failure('Précisez le sujet du complément et la demande, en au moins 5 caractères.', 422);
        if (committeeReturn && (committeeWhy.length < 5 || committeeWhat.length < 5)) return failure('Précisez pourquoi et quoi, en au moins 5 caractères.', 422);
        if (committeeReturn && body.decision === 'VERIFICATION_REQUIRED' && !['PIECE', 'INFORMATION', 'FIELD_VISIT', 'GUARANTEE'].includes(body.subject)) return failure('Précisez le sujet du complément.', 422);
        if (action === 'submit') {
          if (!client) return failure('Profil client introuvable.', 422);
          try { routeRequest(store, row, client); } catch (error) { return failure((error as Error).message); }
        }
        const grants = action === 'decide' && ['APPROVED', 'AMENDED'].includes(body.decision);
        const grantAmount = grants ? Number(body.approved_amount || row.requested_amount) : 0;
        const grantAccount = grants ? activeSavingsAccount(store.profiles.find(item => item.id === row.client_id)) : null;
        if (grants && !(grantAmount > 0)) return failure('Le montant accordé est invalide.', 422);
        if (grants && !grantAccount) return failure('Le client n’a pas de compte épargne actif. L’octroi ne peut pas verser les fonds.', 422);
        row.status = transitions[action];
        if (action === 'submit') row.submitted_at = now();
        if (asksComplement) Object.assign(row, { complement_subject: body.subject, complement_detail: complementDetail });
        if (action === 'review' && row.status === 'PENDING_COMMITTEE') {
          const arrival = scoreArrival(store, row);
          if (body.comment) arrival.analysis_summary = `${arrival.analysis_summary} Avis de l’analyste : ${body.comment}`;
          row.analysis = arrival;
        }
        if (action === 'review') row.analyst_review = body;
        if (action === 'decide' && body.decision === 'ADJOURNED') {
          Object.assign(row, { committee_decision: { decision: 'ADJOURNED', reason: committeeWhy, what: committeeWhat }, adjourn_reason: committeeWhy, adjourn_what: committeeWhat });
        } else if (action === 'decide' && body.decision === 'VERIFICATION_REQUIRED') {
          Object.assign(row, { committee_decision: { decision: 'VERIFICATION_REQUIRED', reason: committeeWhy, what: committeeWhat, subject: body.subject }, complement_subject: body.subject, complement_detail: `Pourquoi : ${committeeWhy}. Quoi : ${committeeWhat}` });
        } else if (action === 'decide') {
          const amount = Number(body.approved_amount || row.requested_amount);
          const months = Math.max(1, Math.min(120, Number(body.approved_duration_months || row.duration_months)));
          const rate = Number(body.interest_rate) > 0 ? Number(body.interest_rate) : ANNUAL_INTEREST_RATE;
          Object.assign(row, { committee_decision: { ...body, interest_rate: rate }, approved_amount: body.approved_amount, approved_duration_months: body.approved_duration_months, interest_rate: rate });
          if (grants && grantAccount) {
            const quote = loanQuote(amount, months, rate);
            const loanId = store.nextId++;
            let outstanding = quote.total;
            const repayments = Array.from({ length: months }, (_, index) => {
              const expected = index === months - 1 ? outstanding : Math.min(quote.monthly, outstanding);
              outstanding -= expected;
              const due = new Date();
              due.setMonth(due.getMonth() + index + 1);
              return { id: store.nextId++, loan_id: loanId, expected_amount: expected, remaining_amount: expected, paid_amount: 0, due_date: due.toISOString(), status: 'PENDING' };
            });
            const balance = Number(grantAccount.balance || 0) + amount;
            grantAccount.balance = balance;
            grantAccount.available_balance = Math.max(0, balance - Number(grantAccount.blocked_balance || 0));
            grantAccount.transactions = grantAccount.transactions || [];
            grantAccount.transactions.push({ id: store.nextId++, reference: `EP-PRET-${loanId}`, booked_at: now(), label: `Épargne + prêt #${loanId}`, type: 'LOAN_DISBURSEMENT', direction: 'CREDIT', amount, status: 'COMPLETED', balance_after: balance, channel: 'Compte épargne' });
            row.loan = { id: loanId, credit_request_id: row.id, client_id: row.client_id, principal_amount: amount, total_amount: quote.total, outstanding_amount: quote.total, interest_amount: quote.interest, interest_rate: rate, duration_months: months, monthly_payment: quote.monthly, status: 'ACTIVE', disbursed_at: now(), funds_received: amount, savings_account_id: grantAccount.id, repayments };
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
    const request = row && store.requests.find(item => item.id === row.credit_request_id && canReadRequest(item));
    if (!row || !request) return failure('Garantie introuvable.', 404);
    const locked = stageLockMessage(request.status, 'agent');
    if (locked) return failure(locked, 403);
    Object.assign(row, body, { verification_status: 'VERIFIED', verified_at: now() }); return commit(row);
  }
  const visitPath = path.match(/^\/agent\/field-visits(?:\/(\d+))?(?:\/(start|complete|cancel))?$/);
  if (visitPath && ['credit_agent', 'admin'].includes(user.role)) {
    const visibleVisits = store.visits.filter(visit => store.requests.some(request => request.id === visit.credit_request_id && canReadRequest(request)));
    if (!visitPath[1] && method === 'GET') return collection(visibleVisits.filter(visit => (!url.searchParams.get('status') || visit.status === url.searchParams.get('status')) && (!url.searchParams.get('credit_request_id') || visit.credit_request_id === Number(url.searchParams.get('credit_request_id')))));
    const visit = visibleVisits.find(item => item.id === Number(visitPath[1]));
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
