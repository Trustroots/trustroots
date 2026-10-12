/** @jest-environment node */

import { canUseWebP } from '@/modules/core/client/utils/dom';

describe('canUseWebP outside a browser', () => {
  it('returns false when window is unavailable', () => {
    expect(canUseWebP()).toBe(false);
  });
});
