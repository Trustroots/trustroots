import {
  formatAdminDateTime,
  formatAdminUtcDate,
  getAdminDateTimeAttribute,
} from '@/modules/admin/client/utils/admin-date';

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

describe('formatAdminDateTime', () => {
  it('returns an em dash for absent, empty, or invalid values', () => {
    expect(formatAdminDateTime()).toBe('—');
    expect(formatAdminDateTime(null)).toBe('—');
    expect(formatAdminDateTime('')).toBe('—');
    expect(formatAdminDateTime('not-a-date')).toBe('—');
  });

  it('formats valid values as a UTC date and time', () => {
    expect(formatAdminDateTime('2024-01-01T00:30:00+02:00')).toBe(
      '2023-12-31 22:30',
    );
    expect(formatAdminDateTime(1704067200000)).toBe('2024-01-01 00:00');
    expect(formatAdminDateTime(new Date('2024-01-01T12:34:56.000Z'))).toBe(
      '2024-01-01 12:34',
    );
    expect(formatAdminDateTime(0)).toBe('1970-01-01 00:00');
  });
});

describe('getAdminDateTimeAttribute', () => {
  it('returns an ISO datetime for valid values and omits invalid values', () => {
    expect(getAdminDateTimeAttribute('2024-01-01T00:30:00+02:00')).toBe(
      '2023-12-31T22:30:00.000Z',
    );
    expect(getAdminDateTimeAttribute(0)).toBe('1970-01-01T00:00:00.000Z');
    expect(getAdminDateTimeAttribute('not-a-date')).toBeUndefined();
    expect(getAdminDateTimeAttribute(null)).toBeUndefined();
  });
});
