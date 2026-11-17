import {
  getNetworkName,
  hasConnectedAdditionalSocialAccounts,
  warmshowersProfileLink,
  socialAccountLink,
} from '@/modules/users/client/utils/networks';

type SocialProfile = Parameters<typeof hasConnectedAdditionalSocialAccounts>[0];
type SocialProviderData = Parameters<typeof socialAccountLink>[1];

describe('user network utilities', () => {
  it('builds Warmshowers app profile links and escapes the profile ID', () => {
    expect(warmshowersProfileLink('00000000-0000-4000-8000-000000000001')).toBe(
      'https://app.warmshowers.org/profiles/00000000-0000-4000-8000-000000000001',
    );
    expect(warmshowersProfileLink('id?query#fragment')).toBe(
      'https://app.warmshowers.org/profiles/id%3Fquery%23fragment',
    );
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
    expect(socialAccountLink('facebook', facebookData)).toBe('#');
    expect(socialAccountLink('twitter', twitterData)).toBe(
      'https://twitter.com/trustroots',
    );
    expect(socialAccountLink('github', githubData)).toBe(
      'https://github.com/trustroots',
    );
    expect(socialAccountLink('facebook', {})).toBe('#');
    expect(socialAccountLink('twitter', {})).toBe('#');
    expect(socialAccountLink('github', {})).toBe('#');
    expect(socialAccountLink('facebook')).toBe('#');
    expect(socialAccountLink('mastodon', unknownProviderData)).toBe('#');
  });

  it('returns display names for known network slugs', () => {
    expect(getNetworkName('couchers')).toBe('Couchers.org');
    expect(getNetworkName('bewelcome')).toBe('BeWelcome');
    expect(getNetworkName('couchsurfing')).toBe('Couchsurfing');
    expect(getNetworkName('facebook')).toBe('Facebook');
    expect(getNetworkName('github')).toBe('GitHub');
    expect(getNetworkName('nostr')).toBe('Nostroots');
    expect(getNetworkName('twitter')).toBe('Twitter');
    expect(getNetworkName('warmshowers')).toBe('Warmshowers');
    expect(getNetworkName('unknown-network')).toBe('unknown-network');
  });
});
