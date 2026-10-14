import { formatAdminUtcDate } from '@/modules/admin/client/utils/admin-date';

describe('formatAdminUtcDate', () => {
  it('returns null for absent, falsy, and invalid values', () => {
    expect(formatAdminUtcDate()).toBeNull();
    expect(formatAdminUtcDate(null)).toBeNull();
    expect(formatAdminUtcDate('')).toBeNull();
    expect(formatAdminUtcDate(0)).toBeNull();
    expect(formatAdminUtcDate('not-a-date')).toBeNull();
  });

  it('formats valid values as the UTC calendar date', () => {
    expect(formatAdminUtcDate('2024-01-01T00:30:00+02:00')).toBe('2023-12-31');
    expect(formatAdminUtcDate(1704067200000)).toBe('2024-01-01');
  });
});
