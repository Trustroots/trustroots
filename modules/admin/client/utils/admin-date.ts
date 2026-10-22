export function formatAdminUtcDate(value?: string | number | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

export function formatAdminDateTime(
  value?: string | number | Date | null,
): string {
  if (value === undefined || value === null || value === '') {
    return '—';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toISOString().slice(0, 16).replace('T', ' ');
}

export function getAdminDateTimeAttribute(
  value?: string | number | Date | null,
): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
