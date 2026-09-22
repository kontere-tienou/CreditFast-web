import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';

const calls = [];
let response;
let failure;
function load(file, dependencies = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, URLSearchParams, Date, Error, require(name) { if (!(name in dependencies)) throw new Error(name); return dependencies[name]; } }, { filename: file });
  return module.exports;
}
const api = load('src/api/fieldVisits.ts', { './client': { apiJson: async (path, options = {}) => { calls.push({ path, ...options }); if (failure) throw failure; return response; } } });
const policy = load('src/features/agent/fieldVisitPolicy.ts');
const row = { id: 12, credit_request_id: 7, status: 'SCHEDULED', visit_type: 'ACTIVITY_SITE', scheduled_at: '2026-10-01T09:30:00Z' };
response = { data: [row], meta: { current_page: 2, last_page: 5 } };
const page = await api.listFieldVisits({ page: 2, status: 'SCHEDULED', credit_request_id: 7 });
assert.equal(page.page, 2); assert.equal(page.lastPage, 5); assert.equal(page.items[0].id, 12);
assert.match(calls.at(-1).path, /status=SCHEDULED/); assert.match(calls.at(-1).path, /credit_request_id=7/);
response = { field_visits: [row] };
assert.equal((await api.listRequestFieldVisits(7)).items.length, 1);
assert.equal(calls.at(-1).path, '/agent/requests/7/field-visits?page=1&per_page=20');
for (const envelope of [row, { field_visit: row }, { visit: row }, { data: row }]) {
  response = envelope; assert.equal((await api.getFieldVisit(12)).id, 12);
}
assert.throws(() => api.unwrapVisitPage({ message: 'Invalid' }));
assert.throws(() => api.unwrapFieldVisit({ field_visit: {} }));
assert.throws(() => api.unwrapVisitPage({ data: [row], meta: { current_page: 3, last_page: 2 } }));
assert.equal(api.unwrapVisitPage([]).items.length, 0);
assert.equal(api.unwrapVisitPage({ data: { data: [row], current_page: 1, last_page: 4 } }).lastPage, 4);
response = { message: 'Saved' };
const schedule = { visit_type: 'ACTIVITY_SITE', scheduled_at: '2026-10-01T09:30:00.000Z', latitude: 0, longitude: 0, purpose: 'Contrôle du stock' };
const mutations = [
  [() => api.createFieldVisit(7, schedule), 'POST', '/agent/requests/7/field-visits', schedule],
  [() => api.updateFieldVisit(12, schedule), 'PUT', '/agent/field-visits/12', schedule],
  [() => api.startFieldVisit(12), 'POST', '/agent/field-visits/12/start', undefined],
  [() => api.completeFieldVisit(12, { outcome: 'RESERVED', findings: 'Stock inférieur', recommendations: 'Revoir le montant' }), 'POST', '/agent/field-visits/12/complete', { outcome: 'RESERVED', findings: 'Stock inférieur', recommendations: 'Revoir le montant' }],
  [() => api.cancelFieldVisit(12, { reason: 'Client absent', as_no_show: true }), 'POST', '/agent/field-visits/12/cancel', { reason: 'Client absent', as_no_show: true }],
];
for (const [run, method, path, body] of mutations) {
  await run(); const sent = calls.at(-1);
  assert.equal(sent.method, method); assert.equal(sent.path, path);
  assert.deepEqual(sent.body ? JSON.parse(sent.body) : undefined, body);
}
await api.cancelFieldVisit(12, { reason: 'Report demandé', as_no_show: false });
assert.equal(JSON.parse(calls.at(-1).body).as_no_show, false);
failure = new Error('403'); await assert.rejects(api.listFieldVisits(), /403/); await assert.rejects(api.startFieldVisit(12), /403/); failure = undefined;

assert.equal(policy.visitActions('SCHEDULED').start, true);
assert.equal(policy.visitActions('SCHEDULED').complete, false);
assert.equal(policy.visitActions('IN_PROGRESS').complete, true);
assert.equal(policy.visitActions('IN_PROGRESS').start, false);
for (const status of ['COMPLETED', 'CANCELLED', 'NO_SHOW', undefined, 'UNKNOWN']) assert.equal(Object.values(policy.visitActions(status)).some(Boolean), false);
for (const status of ['SUBMITTED', 'VERIFICATION_REQUIRED', 'ANALYSIS', 'CREDIT_REVIEW']) assert.equal(policy.canPlanVisit(status), true);
for (const status of ['DRAFT', 'APPROVED', 'REJECTED', 'DISBURSED', undefined]) assert.equal(policy.canPlanVisit(status), false);
assert.equal(policy.visitCoordinates('0', '0').latitude, 0);
assert.equal(policy.visitCoordinates('', '').longitude, null);
for (const pair of [['91', '0'], ['0', '181'], ['', '12'], ['text', '0']]) assert.throws(() => policy.visitCoordinates(...pair));
const local = '2026-10-01T09:30';
assert.equal(policy.localDateTime(policy.scheduleTimestamp(local)), local);
assert.throws(() => policy.scheduleTimestamp(''));
assert.throws(() => policy.scheduleTimestamp('2026-02-30T09:30'));
console.log('Field visits: all 8 endpoint contracts, response envelopes, pagination, propagated errors, state transitions, date roundtrip and coordinate validation passed (offline).');
