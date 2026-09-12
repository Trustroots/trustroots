const KEYWORDS = ['support', 'system', 'trustroots'];

exports.matchSignupProfile = function (profile) {
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
};

exports.KEYWORDS = KEYWORDS;
