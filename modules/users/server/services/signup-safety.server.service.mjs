export const KEYWORDS = ['support', 'system', 'trustroots'];
export function matchSignupProfile(profile) {
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
export { defaultInterop as 'module.exports' };
