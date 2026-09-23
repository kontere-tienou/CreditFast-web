const GROUP = /\B(?=(\d{3})+(?!\d))/g;

export function formatAmount(value: number) {
  return String(Math.round(value)).replace(GROUP, ' ');
}

export function parseAmount(value?: string | null) {
  if (value == null) {
    return null;
  }
  const digits = String(value).replace(/[^\d-]/g, '');
  if (!digits || digits === '-') {
    return null;
  }
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseDecimal(value?: string | null) {
  if (value == null || String(value).trim() === '') {
    return null;
  }
  const parsed = Number(String(value).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}
