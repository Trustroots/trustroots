import { featureId } from '@/modules/search/client/utils/feature-id';

describe('featureId', () => {
  it('maps an offer or note id to the same unsigned 32-bit integer each time', () => {
    const id = featureId('665100000000000000000001');
    expect(Number.isInteger(id)).toBe(true);
    expect(id).toBeGreaterThanOrEqual(0);
    expect(id).toBeLessThan(2 ** 32);
    expect(featureId('665100000000000000000001')).toBe(id);
  });

  it('gives different ids to different offers', () => {
    expect(featureId('665100000000000000000001')).not.toBe(
      featureId('665100000000000000000002'),
    );
    expect(featureId('a')).not.toBe(featureId('b'));
    expect(featureId('')).not.toBe(featureId('a'));
  });
});
