import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function importTs(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}

const { isActiveSavingsAccount } = await importTs('../src/features/savings/accountPolicy.ts');
for (const type of ['EPARGNE', 'ÉPARGNE', 'SAVINGS', 'savings_account']) {
  assert.equal(isActiveSavingsAccount({ account_type: type, status: 'ACTIVE' }), true);
  for (const status of ['PENDING', 'REJECTED', 'CLOSED', 'INACTIVE', 'SUSPENDED', 'APPROVED', '', undefined]) {
    assert.equal(isActiveSavingsAccount({ account_type: type, status }), false, `${type}/${status} must block credit`);
  }
}
assert.equal(isActiveSavingsAccount({ account_type: 'CURRENT', status: 'ACTIVE' }), false);
assert.equal(isActiveSavingsAccount({ status: 'ACTIVE' }), false);

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
