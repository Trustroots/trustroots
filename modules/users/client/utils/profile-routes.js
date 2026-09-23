const PROFILE_VIEW_TAB_STATE_NAMES = {
  about: 'profile.about',
  accommodation: 'profile.accommodation',
  contacts: 'profile.contacts',
  experiences: 'profile.experiences.list',
  overview: 'profile.overview',
  tribes: 'profile.tribes',
};

export function getProfileViewTab(pathname, username) {
  const prefix = `/profile/${encodeURIComponent(username)}`;

  if (pathname === prefix || pathname === `${prefix}/`) {
    return 'about';
  }

  if (pathname.startsWith(`${prefix}/`)) {
    const suffix = pathname.slice(prefix.length + 1);

    if (PROFILE_VIEW_TAB_STATE_NAMES[suffix]) {
      return suffix;
    }
  }

  return 'about';
}

export function getProfileViewTabStateName(pathname, username) {
  return PROFILE_VIEW_TAB_STATE_NAMES[getProfileViewTab(pathname, username)];
}

export function isMobileProfileViewport() {
  return window.innerWidth <= 480;
}

export function getMobileProfileRedirect(pathname, username) {
  const tab = getProfileViewTab(pathname, username);
  const prefix = `/profile/${encodeURIComponent(username)}`;

  if (isMobileProfileViewport()) {
    if (pathname === prefix || pathname === `${prefix}/`) {
      return `${prefix}/overview`;
    }

    return null;
  }

  if (tab === 'overview' || tab === 'accommodation') {
    return prefix;
  }

  return null;
}
