const ONBOARDING_URL = 'https://nos.trustroots.org/open/onboarding';

// Only the current viewer's public username belongs in this URL. Native
// onboarding verifies the account; the link does not transfer authentication.
export function getNostrootsOnboardingUrl(username) {
  return username
    ? `${ONBOARDING_URL}?username=${encodeURIComponent(username)}`
    : ONBOARDING_URL;
}
