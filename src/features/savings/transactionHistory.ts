import type { SavingsTransaction } from '@/api/savings';

export const transactionTypes: Record<SavingsTransaction['type'], string> = { DEPOSIT: 'Dépôt', WITHDRAWAL: 'Retrait', TRANSFER: 'Virement', FEE: 'Frais', INTEREST: 'Intérêts', LOAN_DISBURSEMENT: 'Épargne +' };
export const transactionStatuses: Record<SavingsTransaction['status'], string> = { COMPLETED: 'Comptabilisée', PENDING: 'En attente', CANCELLED: 'Annulée' };
export function transactionsCsv(rows: SavingsTransaction[], accountNumber: string) {
  const cell = (value: unknown) => {
    const text = String(value ?? '');
    return `"${(/^[=+@\-\t\r\n]/.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`;
  };
  const data = [['Compte', 'Référence', 'Date', 'Libellé', 'Type', 'Sens', 'Montant FCFA', 'Statut'], ...rows.map(row => [accountNumber, row.reference, row.booked_at, row.label, transactionTypes[row.type], row.direction === 'CREDIT' ? 'Entrée' : 'Sortie', row.amount, transactionStatuses[row.status]])];
  return '\uFEFF' + data.map(row => row.map(cell).join(';')).join('\r\n');
}
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function cashflowByMonth(rows: SavingsTransaction[], year: number) {
  const months = Array.from({ length: 12 }, () => ({ income: 0, expense: 0 }));
  for (const row of rows) {
    const month = Number(row.booked_at.slice(5, 7)) - 1;
    if (row.status !== 'COMPLETED' || Number(row.booked_at.slice(0, 4)) !== year || !months[month] || !Number.isFinite(row.amount) || row.amount < 0) continue;
    if (row.direction === 'CREDIT') months[month].income += row.amount;
    if (row.direction === 'DEBIT') months[month].expense += row.amount;
  }
  return months;
}
export function filterTransactions(rows: SavingsTransaction[], query: string, from: string, to: string, type: string) {
  const needle = normalize(query.trim());
  return rows.filter(row => (!from || row.booked_at.slice(0, 10) >= from) && (!to || row.booked_at.slice(0, 10) <= to) && (!type || row.type === type) && normalize(`${row.reference} ${row.label} ${transactionTypes[row.type]}`).includes(needle))
    .sort((a, b) => b.booked_at.localeCompare(a.booked_at) || b.id - a.id);
}
