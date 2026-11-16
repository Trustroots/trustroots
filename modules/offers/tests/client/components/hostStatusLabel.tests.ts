import { hostStatusLabel } from '@/modules/offers/client/components/hostStatusLabel';

describe('hostStatusLabel', () => {
  it.each([
    ['yes', 'Can host'],
    ['maybe', 'Might be able to host'],
    ['no', 'Cannot host currently'],
  ] as const)('labels %s status', (status, expected) => {
    expect(hostStatusLabel(status, key => key)).toBe(expected);
  });
});
