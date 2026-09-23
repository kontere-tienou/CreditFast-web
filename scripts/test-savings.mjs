import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function importTs(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}

const { isActiveSavingsAccount } = await importTs('../src/features/savings/accountPolicy.ts');
const { filterTransactions } = await importTs('../src/features/savings/transactionHistory.ts');
const { transactionsCsv } = await importTs('../src/features/savings/transactionHistory.ts');
const csv = transactionsCsv([{ reference: 'EP-01', booked_at: '2026-09-01', label: '=SUM(1;2) "test"', type: 'DEPOSIT', direction: 'CREDIT', amount: 250000, status: 'COMPLETED' }], 'EP-1');
assert.ok(csv.startsWith('\uFEFF'));
assert.ok(csv.includes('"\'=SUM(1;2) ""test"""'), 'CSV text must escape quotes and neutralize spreadsheet formulas');
assert.ok(csv.includes('"250000"'));
assert.equal(transactionsCsv([], 'EP-1').split('\r\n').length, 1);
const { cashflowByMonth } = await importTs('../src/features/savings/transactionHistory.ts');
const flows = cashflowByMonth([
  { booked_at: '2026-09-01', status: 'COMPLETED', direction: 'CREDIT', amount: 500000 },
  { booked_at: '2026-09-02', status: 'COMPLETED', direction: 'DEBIT', amount: 10000 },
  { booked_at: '2026-09-03', status: 'PENDING', direction: 'CREDIT', amount: 900000 },
  { booked_at: '2025-09-01', status: 'COMPLETED', direction: 'CREDIT', amount: 100000 },
], 2026);
assert.deepEqual(flows[8], { income: 500000, expense: 10000 });
assert.equal(flows.length, 12);
assert.deepEqual(flows[0], { income: 0, expense: 0 });
const transactions = [
  { id: 1, reference: 'EP-001', label: 'Intérêts crédités', type: 'INTEREST', booked_at: '2026-09-15T16:00:00Z' },
  { id: 2, reference: 'EP-002', label: 'Versement', type: 'DEPOSIT', booked_at: '2026-09-16' },
];
assert.deepEqual(filterTransactions(transactions, 'interets', '2026-09-15', '2026-09-15', '').map(row => row.id), [1]);
assert.deepEqual(filterTransactions(transactions, 'EP-002', '', '', 'DEPOSIT').map(row => row.id), [2]);
assert.deepEqual(filterTransactions(transactions, '', '', '', '').map(row => row.id), [2, 1]);
assert.deepEqual(filterTransactions([], '', '', '', ''), []);
for (const type of ['EPARGNE', 'ÉPARGNE', 'SAVINGS', 'savings_account']) {
  assert.equal(isActiveSavingsAccount({ account_type: type, status: 'ACTIVE' }), true);
  for (const status of ['PENDING', 'REJECTED', 'CLOSED', 'INACTIVE', 'SUSPENDED', 'APPROVED', '', undefined]) {
    assert.equal(isActiveSavingsAccount({ account_type: type, status }), false, `${type}/${status} must block credit`);
  }
}
assert.equal(isActiveSavingsAccount({ account_type: 'CURRENT', status: 'ACTIVE' }), false);
assert.equal(isActiveSavingsAccount({ status: 'ACTIVE' }), false);
assert.equal(isActiveSavingsAccount({ account_type: 'EPARGNE', status: 'ACTIF' }), true);
assert.equal(isActiveSavingsAccount({ account_type: ' épargne ', status: ' actif ' }), true);
assert.equal(isActiveSavingsAccount({ account_type: 'COURANT', status: 'ACTIF' }), false);
assert.equal(isActiveSavingsAccount({ account_type: 'EPARGNE', status: 'INACTIF' }), false);

const profileSource = await readFile(new URL('../src/api/profile.ts', import.meta.url), 'utf8');
const profileAst = ts.createSourceFile('profile.ts', profileSource, ts.ScriptTarget.Latest, true);
const identitySource = profileAst.statements.filter(statement => {
  if (ts.isFunctionDeclaration(statement)) return ['isKycIdentityType', 'hasRequiredIdentityDocument'].includes(statement.name?.text);
  return ts.isVariableStatement(statement) && statement.declarationList.declarations.some(declaration => declaration.name.getText(profileAst) === 'KYC_IDENTITY_TYPES');
}).map(statement => statement.getText(profileAst)).join('\n');
const identityJs = ts.transpileModule(identitySource, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { hasRequiredIdentityDocument } = await import(`data:text/javascript;base64,${Buffer.from(identityJs).toString('base64')}`);
assert.equal(hasRequiredIdentityDocument([]), false);
for (const document_type of ['CNI', 'NINA', 'PASSEPORT', 'PIECE_IDENTITE']) {
  assert.equal(hasRequiredIdentityDocument([{ document_type, status: 'UPLOADED' }]), true);
  assert.equal(hasRequiredIdentityDocument([{ document_type, status: 'REJECTED' }]), false);
  assert.equal(hasRequiredIdentityDocument([{ document_type, expires_at: '2000-01-01' }]), false);
}
assert.equal(hasRequiredIdentityDocument([{ document_type: 'PREUVE_REVENU' }]), false);

const { validateMembership } = await importTs('../src/features/savings/membershipFields.ts');
const valid = { birth_date: '1990-01-01', identity_issued_at: '2020-01-01', identity_expires_at: '2099-01-01', pep: 'Non' };
assert.equal(validateMembership(valid, new FormData(), false), null);
assert.ok(validateMembership({ ...valid, pep: 'Oui' }, new FormData(), false));
assert.ok(validateMembership({ ...valid, identity_expires_at: '2021-01-01' }, new FormData(), false));
assert.ok(validateMembership({ ...valid, birth_date: '2099-01-01' }, new FormData(), false));
assert.ok(validateMembership({ ...valid, identity_issued_at: '2099-01-01' }, new FormData(), false));
assert.ok(validateMembership({ pep: 'Non' }, new FormData(), true));
const files = new FormData();
files.set('approval_copy', new Blob(['test'], { type: 'application/pdf' }), 'approval.pdf');
assert.equal(validateMembership({ pep: 'Non' }, files, true), null);
assert.ok(validateMembership({ pep: 'Non', legal_form: 'Association' }, files, true));
assert.equal(validateMembership({ pep: 'Non', legal_form: 'Association', receipt_number: 'ASS-1' }, files, true), null);
assert.equal(validateMembership({ pep: 'Non' }, new FormData(), true, new Set(['rccm_copy'])), null, 'Previously received RCCM must survive corrections');
assert.ok(validateMembership({ pep: 'Non' }, new FormData(), true, new Set(['photo'])), 'An unrelated retained document must not replace RCCM');

const storage = new Map();
globalThis.sessionStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: key => storage.delete(key),
};
const { writeSavingsSession, readSavingsSession, clearSavingsSession, membershipStatusLabel } = await importTs('../src/features/savings/workflow.ts');
const draft = { clientType: 'PHYSICAL_PERSON', fields: { first_name: 'Awa' }, savedAt: '2026-09-22' };
writeSavingsSession('client-a', 'draft', draft);
assert.deepEqual(readSavingsSession('client-a', 'draft'), draft);
assert.equal(readSavingsSession('client-b', 'draft'), null, 'Drafts must be isolated per user');
const intent = { amount: 250000, duration: 12, purpose: 'Commerce' };
writeSavingsSession('client-a', 'loan', intent);
clearSavingsSession('client-a', 'draft');
assert.equal(readSavingsSession('client-a', 'draft'), null);
assert.deepEqual(readSavingsSession('client-a', 'loan'), intent, 'Submitting membership must preserve the original loan');
clearSavingsSession('client-a', 'loan');
assert.equal(readSavingsSession('client-a', 'loan'), null);
storage.set('creditfast:savings:client-a:draft', 'bad json');
assert.equal(readSavingsSession('client-a', 'draft'), null, 'A corrupted draft must not crash the form');
assert.equal(membershipStatusLabel('CHANGES_REQUESTED'), 'À compléter');
console.log('Workflow checks passed: retained documents, draft isolation, recovery, loan intent and correction status.');
console.log('Savings checks passed: account eligibility, pending/rejected/unknown states, PPE, identity dates and legal documents.');
