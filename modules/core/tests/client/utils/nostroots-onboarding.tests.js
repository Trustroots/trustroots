import { getNostrootsOnboardingUrl } from '@/modules/core/client/utils/nostroots-onboarding';

describe('Nostroots onboarding URL', () => {
  it.each([undefined, null, ''])('omits missing usernames (%s)', username => {
    expect(getNostrootsOnboardingUrl(username)).toBe(
      'https://nos.trustroots.org/open/onboarding',
    );
  });

  it('encodes the username as a single query parameter on the fixed route', () => {
    const username = 'sample&destination=https://example.org/#test';
    const url = new URL(getNostrootsOnboardingUrl(username));

    expect(url.origin).toBe('https://nos.trustroots.org');
    expect(url.pathname).toBe('/open/onboarding');
    expect([...url.searchParams.entries()]).toEqual([['username', username]]);
    expect(url.hash).toBe('');
  });
});
