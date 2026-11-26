function identifier(user) {
  const value = user._id || user.id;
  return value ? String(value) : '';
}

exports.currentMember = function (user) {
  return {
    id: identifier(user),
    username: user.username,
    displayName: user.displayName || user.username,
    public: Boolean(user.public),
    emailConfirmed: user.public === true,
    mfaEnabled: user.mfaEnabled === true,
    email: user.email,
    newsletter: Boolean(user.newsletter),
  };
};

function circleMembership(membership) {
  const circle = membership && membership.tribe;
  if (!circle) {
    return null;
  }
  const tribe = {
    id: identifier(circle),
    label: circle.label || 'Circle',
  };
  for (const field of ['slug', 'description', 'count', 'image', 'color']) {
    if (circle[field] !== undefined && circle[field] !== null) {
      tribe[field] = circle[field];
    }
  }
  return { tribe };
}

function canViewAccountDetails(profile, authenticatedUser) {
  if (!authenticatedUser) {
    return false;
  }
  const isOwner = identifier(profile) === identifier(authenticatedUser);
  // Stryker disable next-line ArrayDeclaration: a placeholder role also cannot grant admin access.
  const isAdmin = (authenticatedUser.roles || []).includes('admin');
  return isOwner || isAdmin;
}

exports.profile = function (profile, authenticatedUser) {
  const presented = {
    id: identifier(profile),
    username: profile.username,
    displayName: profile.displayName || profile.username,
    tagline: profile.tagline || null,
    description: profile.description || null,
    locationLiving: profile.locationLiving || null,
    locationFrom: profile.locationFrom || null,
    languages: profile.languages || [],
    created: profile.created || null,
    seen: profile.seen || null,
    replyRate: profile.replyRate || null,
    replyTime: profile.replyTime || null,
    avatarUploaded: Boolean(profile.avatarUploaded),
    // Stryker disable next-line ArrayDeclaration: placeholder entries have no tribe and are filtered out, like the empty list.
    member: (profile.member || []).map(circleMembership).filter(Boolean),
  };

  if (canViewAccountDetails(profile, authenticatedUser)) {
    presented.nostrNpub = profile.nostrNpub || null;
    presented.email = profile.email || null;
    presented.emailTemporary = profile.emailTemporary || null;
    presented.newsletter = Boolean(profile.newsletter);
  }
  if (
    authenticatedUser &&
    identifier(profile) === identifier(authenticatedUser)
  ) {
    presented.emailConfirmed = authenticatedUser.public === true;
    presented.mfaEnabled = authenticatedUser.mfaEnabled === true;
  }

  return presented;
};
