/**
 * Determine if given user handle for Warmshowers is an id or username
 * @link https://github.com/Trustroots/trustroots/issues/308
 */
function isWarmshowersId(profile) {
  // WarmShowers id should contain only digits
  return /^[0-9]*$/.test(profile.extSitesWS);
}

/**
 * Check if there are additional accounts
 */
function hasConnectedAdditionalSocialAccounts(profile) {
  return (profile.additionalProvidersData && Object.keys(profile.additionalProvidersData).length);
}

/**
 * Return an URL for user's social media profiles
 * Ensure these values are published at users.profile.server.controller.js
 */
function socialAccountLink(providerName, providerData) {
  if (providerName === 'facebook' && providerData.id) {
    return 'https://www.facebook.com/app_scoped_user_id/' + providerData.id;
  } else if (providerName === 'twitter' && providerData.screen_name) {
    return 'https://twitter.com/' + providerData.screen_name;
  } else if (providerName === 'github' && providerData.login) {
    return 'https://github.com/' + providerData.login;
  } else {
    return '#';
  }
}



module.exports = { hasConnectedAdditionalSocialAccounts, socialAccountLink, isWarmshowersId };