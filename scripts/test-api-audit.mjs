// Offline characterization checks: no real account, upload or financial operation.
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import assert from 'node:assert/strict';

const calls = [];
let response = {};
let failure;
const client = { apiJson: async (path, options = {}) => { calls.push({ path, ...options }); if (failure) throw failure; return response; }, apiBlob: async path => ({ blob: new Blob([path]) }) };
function load(file, dependencies = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, require: name => {
    if (name in dependencies) return dependencies[name];
    throw new Error(`Missing offline dependency: ${name}`);
  }, FormData, Blob, File, AbortSignal, Error, TypeError, DOMException, console }, { filename: file });
  return module.exports;
}
const admin = load('src/api/admin.ts', { './client': client });
const credit = load('src/api/credit.ts', { './client': client, './admin': admin, './savings': { requireActiveSavingsAccount: async () => {} } });
const loans = load('src/api/loans.ts', { './client': client, './admin': admin });
const errors = load('src/api/errors.ts');
const auth = load('src/api/auth.ts', { './client': client, './errors': errors, './roles': { mapApiRole: () => 'CLIENT' }, '@/app/session': { setUiSession() {}, clearUiSession() {}, getAccessToken: () => 'fixture-only' } });
const agent = load('src/api/agent.ts', { './client': client, './admin': admin, './profile': { asAccounts: value => value, asHistories: value => value } });
const checks = [];
async function check(name, fn) { calls.length = 0; failure = undefined; await fn(); checks.push(name); }

await check('Envelope credit_request correctly decoded', async () => { response = { credit_request: { id: 11 } }; assert.equal((await credit.getCreditRequest(11)).id, 11); });
await check('Credit creation uses POST and expected fields', async () => {
  response = { credit_request: { id: 11 } };
  await credit.createCreditRequest({ credit_type: 'CONSUMER_PERSONAL', requested_amount: 100000, duration_months: 6, purpose: 'Test', declared_monthly_income: 200000, declared_monthly_expenses: 10000 });
  assert.equal(calls[0].method, 'POST'); assert.equal(calls[0].path, '/credit-requests'); assert.equal(JSON.parse(calls[0].body).requested_amount, 100000);
});
await check('Document upload uses multipart with document_type and file', async () => {
  response = {}; await credit.uploadCreditDocument(11, new File(['fixture'], 'test.pdf', { type: 'application/pdf' }), 'PREUVE_REVENU');
  assert.ok(calls[0].body instanceof FormData); assert.equal(calls[0].body.get('document_type'), 'PREUVE_REVENU'); assert.equal(calls[0].body.get('file').name, 'test.pdf');
});
await check('Guarantee replacement uses POST multipart with _method PUT', async () => {
  response = {}; await credit.updateCreditGuarantee(11, 4, { guarantee_type: 'MATERIEL', declared_value: 50000 }, new File(['fixture'], 'test.pdf'));
  assert.equal(calls[0].method, 'POST'); assert.equal(calls[0].body.get('_method'), 'PUT');
});
await check('Staff password reset includes confirmation', async () => {
  response = {}; await admin.resetAdminUserPassword(2, 'FixturePassword9'); assert.equal(calls[0].method, 'PUT'); assert.equal(JSON.parse(calls[0].body).password_confirmation, 'FixturePassword9');
});
await check('Disbursement decodes loan response', async () => { response = { loan: { id: 8, status: 'ACTIVE' } }; assert.equal((await loans.disburseLoan(8)).status, 'ACTIVE'); assert.equal(calls[0].method, 'POST'); });
await check('Repayment sends paid_amount to expected endpoint', async () => { response = { loan: { id: 8 } }; await loans.recordLoanRepayment(8, 3, { paid_amount: 1000 }); assert.equal(calls[0].path, '/loans/8/repayments/3/record'); assert.equal(JSON.parse(calls[0].body).paid_amount, 1000); });

const reproduced = [];
await check('Characterization: login currently trims password', async () => {
  response = { token: 'fixture-only', user: { id: 1, phone: '+22370000000', role: 'client' } };
  await auth.loginWithCredentials('+22370000000', ' Password9 ');
  assert.equal(JSON.parse(calls[0].body).password, 'Password9'); reproduced.push('F03: leading/trailing spaces removed from password');
});
await check('Characterization: analysis 403 triggers score POST', async () => {
  failure = new errors.ApiError('Forbidden', 403);
  await assert.rejects(credit.loadCreditAnalysis(11));
  assert.equal(calls.length, 2); assert.equal(calls[1].path, '/credit-requests/11/score'); reproduced.push('F04: GET failure causes score mutation attempt');
});
await check('Characterization: KYC network error becomes empty list', async () => {
  failure = new TypeError('Failed to fetch');
  assert.equal((await agent.listAgentClientKycDocuments(1)).length, 0); reproduced.push('F05: failed KYC lookup reported as empty documents');
});
const result = { kind: 'offline fixtures, not live API certification', checks, reproduced };
fs.writeFileSync('tmp/api-audit-tests.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
