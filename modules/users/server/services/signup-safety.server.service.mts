export const KEYWORDS = ['support', 'system', 'trustroots'];
interface SignupProfileText {
  firstName?: unknown;
  lastName?: unknown;
  displayName?: unknown;
  username?: unknown;
}

export function matchSignupProfile<T extends SignupProfileText>(
  profile: T,
): string[] {
  const identifyingText = [
    profile.firstName,
    profile.lastName,
    profile.displayName,
    profile.username,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return KEYWORDS.filter(keyword => identifyingText.includes(keyword));
}
const defaultInterop = {
  KEYWORDS,
  matchSignupProfile,
};
export default defaultInterop;
