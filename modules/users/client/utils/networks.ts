import type {
  PublicProviderIdentities,
  PublicProviderIdentity,
} from '../../shared/profile';

interface SocialProfile {
  additionalProvidersData?: PublicProviderIdentities;
}

export function warmshowersProfileLink(id: string): string {
  return `https://app.warmshowers.org/profiles/${encodeURIComponent(id)}`;
}

/**
 * Check if there are additional accounts
 */
export function hasConnectedAdditionalSocialAccounts(
  profile: SocialProfile,
): boolean {
  return !!(
    profile.additionalProvidersData &&
    Object.keys(profile.additionalProvidersData).length > 0
  );
}

/**
 * Return an URL for user's social media profiles
 * Ensure these values are published at users.profile.server.controller.js
 */
export function socialAccountLink(
  providerName: string,
  providerData: PublicProviderIdentity = {},
): string {
  if (
    providerName === 'twitter' &&
    'screen_name' in providerData &&
    providerData.screen_name
  ) {
    return `https://twitter.com/${providerData.screen_name}`;
  } else if (
    providerName === 'github' &&
    'login' in providerData &&
    providerData.login
  ) {
    return `https://github.com/${providerData.login}`;
  } else {
    return '#';
  }
}

/**
 * Get name for a network by slug.
 * @param  {string} network Network slug.
 * @return {string} Name of the network or slug if not found.
 */
export function getNetworkName(network: string): string {
  switch (network) {
    case 'couchers':
      return 'Couchers.org';
    case 'bewelcome':
      return 'BeWelcome';
    case 'couchsurfing':
      return 'Couchsurfing';
    case 'facebook':
      return 'Facebook';
    case 'github':
      return 'GitHub';
    case 'nostr':
      return 'Nostroots';
    case 'twitter':
      return 'Twitter';
    case 'warmshowers':
      return 'Warmshowers';
    default:
      return network;
  }
}
