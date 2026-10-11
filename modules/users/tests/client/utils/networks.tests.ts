import {
  getNetworkName,
  hasConnectedAdditionalSocialAccounts,
  isWarmshowersId,
  socialAccountLink,
} from '@/modules/users/client/utils/networks';

type SocialProfile = Parameters<typeof hasConnectedAdditionalSocialAccounts>[0];
type SocialProviderData = Parameters<typeof socialAccountLink>[1];

describe('user network utilities', () => {
  it('identifies Warmshowers numeric ids', () => {
    expect(isWarmshowersId('12345')).toBe(true);
    expect(isWarmshowersId('')).toBe(true);
    expect(isWarmshowersId('warmshowers-user')).toBe(false);
  });

  it('detects connected additional social accounts', () => {
    const connectedProfile: SocialProfile = {
      additionalProvidersData: { github: { login: 'trustroots' } },
    };
    expect(hasConnectedAdditionalSocialAccounts(connectedProfile)).toBe(true);
    expect(
      hasConnectedAdditionalSocialAccounts({
        additionalProvidersData: {},
      }),
    ).toBe(false);
    expect(hasConnectedAdditionalSocialAccounts({})).toBeFalsy();
  });

  it('builds social account links for known providers', () => {
    const facebookData: SocialProviderData = { id: 'abc123' };
    const twitterData: SocialProviderData = { screen_name: 'trustroots' };
    const githubData: SocialProviderData = { login: 'trustroots' };
    const unknownProviderData: SocialProviderData & { username: string } = {
      username: 'trustroots',
    };
    expect(socialAccountLink('facebook', facebookData)).toBe(
      'https://www.facebook.com/app_scoped_user_id/abc123',
    );
    expect(socialAccountLink('twitter', twitterData)).toBe(
      'https://twitter.com/trustroots',
    );
    expect(socialAccountLink('github', githubData)).toBe(
      'https://github.com/trustroots',
    );
    expect(socialAccountLink('facebook', {})).toBe('#');
    expect(socialAccountLink('twitter', {})).toBe('#');
    expect(socialAccountLink('github', {})).toBe('#');
    expect(socialAccountLink('mastodon', unknownProviderData)).toBe('#');
  });

  it('returns display names for known network slugs', () => {
    expect(getNetworkName('couchers')).toBe('Couchers.org');
    expect(getNetworkName('bewelcome')).toBe('BeWelcome');
    expect(getNetworkName('couchsurfing')).toBe('Couchsurfing');
    expect(getNetworkName('facebook')).toBe('Facebook');
    expect(getNetworkName('github')).toBe('GitHub');
    expect(getNetworkName('twitter')).toBe('Twitter');
    expect(getNetworkName('warmshowers')).toBe('Warmshowers');
    expect(getNetworkName('unknown-network')).toBe('unknown-network');
  });
});
