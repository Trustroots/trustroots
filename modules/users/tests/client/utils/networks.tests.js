import {
  getNetworkName,
  hasConnectedAdditionalSocialAccounts,
  isWarmshowersId,
  socialAccountLink,
} from '@/modules/users/client/utils/networks';

describe('user network utilities', () => {
  it('identifies Warmshowers numeric ids', () => {
    expect(isWarmshowersId('12345')).toBe(true);
    expect(isWarmshowersId('warmshowers-user')).toBe(false);
  });

  it('detects connected additional social accounts', () => {
    expect(
      hasConnectedAdditionalSocialAccounts({
        additionalProvidersData: { github: { login: 'trustroots' } },
      }),
    ).toBe(true);
    expect(hasConnectedAdditionalSocialAccounts({})).toBeFalsy();
  });

  it('builds social account links for known providers', () => {
    expect(socialAccountLink('facebook', { id: 'abc123' })).toBe(
      'https://www.facebook.com/app_scoped_user_id/abc123',
    );
    expect(socialAccountLink('twitter', { screen_name: 'trustroots' })).toBe(
      'https://twitter.com/trustroots',
    );
    expect(socialAccountLink('github', { login: 'trustroots' })).toBe(
      'https://github.com/trustroots',
    );
    expect(socialAccountLink('mastodon', { username: 'trustroots' })).toBe('#');
  });

  it('returns display names for known network slugs', () => {
    expect(getNetworkName('bewelcome')).toBe('BeWelcome');
    expect(getNetworkName('warmshowers')).toBe('Warmshowers');
    expect(getNetworkName('unknown-network')).toBe('unknown-network');
  });
});
