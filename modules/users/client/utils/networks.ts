interface SocialProfile {
  additionalProvidersData?: Record<
    string,
    Record<string, string | number | undefined>
  >;
}

interface SocialProviderData {
  id?: string | number;
  screen_name?: string;
  login?: string;
}

/**
 * Determine if given user handle for Warmshowers is an id or username
 * @link https://github.com/Trustroots/trustroots/issues/308
 */
export function isWarmshowersId(id: string): boolean {
  // WarmShowers id should contain only digits
  return /^[0-9]*$/.test(id);
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
  providerData: SocialProviderData,
): string {
  if (providerName === 'facebook' && providerData.id) {
    return `https://www.facebook.com/app_scoped_user_id/${providerData.id}`;
  } else if (providerName === 'twitter' && providerData.screen_name) {
    return `https://twitter.com/${providerData.screen_name}`;
  } else if (providerName === 'github' && providerData.login) {
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
