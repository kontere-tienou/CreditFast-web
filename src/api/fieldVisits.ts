import { apiJson } from './client';

export type FieldVisitType = 'ACTIVITY_SITE' | 'RESIDENCE' | 'GUARANTEE_ASSET' | 'OTHER';
export type FieldVisitStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
export type FieldVisitOutcome = 'FAVORABLE' | 'RESERVED' | 'UNFAVORABLE';
export type FieldVisit = {
  id: number;
  credit_request_id?: number;
  visit_type?: FieldVisitType;
  status?: FieldVisitStatus;
  scheduled_at?: string;
  started_at?: string | null;
  completed_at?: string | null;
  cancelled_at?: string | null;
  location_label?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  purpose?: string | null;
  outcome?: FieldVisitOutcome | null;
  findings?: string | null;
  recommendations?: string | null;
  cancellation_reason?: string | null;
  reason?: string | null;
};
export type VisitLocation = { location_label?: string | null; latitude?: number | null; longitude?: number | null };
export type ScheduleFieldVisit = VisitLocation & { visit_type: FieldVisitType; scheduled_at: string; purpose?: string | null };
export type CompleteFieldVisit = VisitLocation & { outcome: FieldVisitOutcome; findings: string; recommendations?: string | null };
export type VisitPage = { items: FieldVisit[]; page: number; lastPage: number };

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function visit(value: unknown): FieldVisit {
  const row = record(value);
  if (!row || !Number.isInteger(Number(row.id)) || Number(row.id) <= 0) throw new Error('Réponse de visite terrain invalide. Actualisez la liste.');
  return { ...row, id: Number(row.id) } as FieldVisit;
}
export function unwrapFieldVisit(payload: unknown): FieldVisit {
  const row = record(payload);
  return visit(row?.field_visit ?? row?.visit ?? row?.data ?? payload);
}
export function unwrapVisitPage(payload: unknown, requestedPage = 1): VisitPage {
  const root = record(payload);
  const nested = record(root?.data) ?? record(root?.field_visits);
  const rows = Array.isArray(payload) ? payload : root?.data ?? root?.field_visits ?? root?.visits;
  const items = Array.isArray(rows) ? rows : nested?.data;
  if (!Array.isArray(items)) throw new Error('La liste des visites n’a pas pu être lue. Réessayez.');
  const meta = record(root?.meta) ?? record(nested?.meta) ?? nested ?? root;
  const page = Number(meta?.current_page ?? root?.current_page ?? requestedPage);
  const lastPage = Number(meta?.last_page ?? root?.last_page ?? page);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(lastPage) || lastPage < page) throw new Error('Pagination des visites invalide.');
  return { items: items.map(visit), page, lastPage };
}

export async function listFieldVisits(filters: { status?: FieldVisitStatus; credit_request_id?: number; page?: number } = {}) {
  const query = new URLSearchParams({ page: String(filters.page ?? 1), per_page: '20' });
  if (filters.status) query.set('status', filters.status);
  if (filters.credit_request_id) query.set('credit_request_id', String(filters.credit_request_id));
  return unwrapVisitPage(await apiJson<unknown>(`/agent/field-visits?${query}`), filters.page);
}
export async function listRequestFieldVisits(requestId: number, page = 1) {
  return unwrapVisitPage(await apiJson<unknown>(`/agent/requests/${requestId}/field-visits?page=${page}&per_page=20`), page);
}
export async function getFieldVisit(id: number) {
  return unwrapFieldVisit(await apiJson<unknown>(`/agent/field-visits/${id}`));
}
// Mutation responses are intentionally not assumed to contain the visit: Swagger
// does not specify an envelope. The screen reloads the authoritative detail/list.
export function createFieldVisit(requestId: number, body: ScheduleFieldVisit) {
  return apiJson<unknown>(`/agent/requests/${requestId}/field-visits`, { method: 'POST', body: JSON.stringify(body) });
}
export function updateFieldVisit(id: number, body: Partial<ScheduleFieldVisit>) {
  return apiJson<unknown>(`/agent/field-visits/${id}`, { method: 'PUT', body: JSON.stringify(body) });
}
export function startFieldVisit(id: number) {
  return apiJson<unknown>(`/agent/field-visits/${id}/start`, { method: 'POST' });
}
export function completeFieldVisit(id: number, body: CompleteFieldVisit) {
  return apiJson<unknown>(`/agent/field-visits/${id}/complete`, { method: 'POST', body: JSON.stringify(body) });
}
export function cancelFieldVisit(id: number, body: { reason: string; as_no_show: boolean }) {
  return apiJson<unknown>(`/agent/field-visits/${id}/cancel`, { method: 'POST', body: JSON.stringify(body) });
}
