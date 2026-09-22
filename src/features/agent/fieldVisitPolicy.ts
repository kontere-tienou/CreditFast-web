export const visitTypes = { ACTIVITY_SITE: 'Lieu d’activité', RESIDENCE: 'Domicile', GUARANTEE_ASSET: 'Bien en garantie', OTHER: 'Autre vérification' };
export const visitStatuses = { SCHEDULED: 'Planifiée', IN_PROGRESS: 'En cours', COMPLETED: 'Terminée', CANCELLED: 'Annulée', NO_SHOW: 'Client absent' };
export const visitOutcomes = { FAVORABLE: 'Favorable', RESERVED: 'Avec réserves', UNFAVORABLE: 'Défavorable' };
export function canPlanVisit(requestStatus?: string) { return ['SUBMITTED', 'VERIFICATION_REQUIRED', 'ANALYSIS', 'CREDIT_REVIEW'].includes(requestStatus ?? ''); }
export function visitActions(status?: string) {
  return { edit: status === 'SCHEDULED' || status === 'IN_PROGRESS', start: status === 'SCHEDULED', complete: status === 'IN_PROGRESS', cancel: status === 'SCHEDULED' || status === 'IN_PROGRESS' };
}
export function localDateTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
export function scheduleTimestamp(value: string) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime()) || localDateTime(date.toISOString()) !== value) throw new Error('Indiquez une date et une heure valides.');
  return date.toISOString();
}
export function visitCoordinates(latitude: string, longitude: string) {
  if (!latitude.trim() && !longitude.trim()) return { latitude: null, longitude: null };
  const lat = Number(latitude), lng = Number(longitude);
  if (!latitude.trim() || !longitude.trim() || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new Error('Renseignez une latitude entre −90 et 90 et une longitude entre −180 et 180.');
  return { latitude: lat, longitude: lng };
}
