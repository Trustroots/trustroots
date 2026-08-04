import { formatBytes } from '@/modules/core/client/utils/format';

describe('format utils', () => {
  it('formats byte sizes for display', () => {
    expect(formatBytes(0)).toBe('0 Byte');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB');
  });
});
