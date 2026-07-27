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
    email: user.email,
    newsletter: Boolean(user.newsletter),
  };
};

function circleMembership(membership) {
  const circle = membership && membership.tribe;
  if (!circle) {
    return null;
  }
  return {
    tribe: {
      id: identifier(circle),
      label: circle.label || 'Circle',
    },
  };
}

function canViewAccountDetails(profile, authenticatedUser) {
  if (!authenticatedUser) {
    return false;
  }
  const isOwner = identifier(profile) === identifier(authenticatedUser);
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
    avatarUploaded: Boolean(profile.avatarUploaded),
    member: (profile.member || []).map(circleMembership).filter(Boolean),
  };

  if (canViewAccountDetails(profile, authenticatedUser)) {
    presented.email = profile.email || null;
    presented.emailTemporary = profile.emailTemporary || null;
    presented.newsletter = Boolean(profile.newsletter);
  }

  return presented;
};
