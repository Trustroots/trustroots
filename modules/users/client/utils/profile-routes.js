const PROFILE_VIEW_TAB_STATE_NAMES = {
  about: 'profile.about',
  accommodation: 'profile.accommodation',
  contacts: 'profile.contacts',
  experiences: 'profile.experiences.list',
  'experiences-new': 'profile.experiences.new',
  overview: 'profile.overview',
  tribes: 'profile.tribes',
};

const PROFILE_EDIT_TAB_PATHS = {
  about: '/profile/edit',
  locations: '/profile/edit/locations',
  photo: '/profile/edit/photo',
  networks: '/profile/edit/networks',
  account: '/profile/edit/account',
};

export function getProfileViewTab(pathname, username) {
  const prefix = `/profile/${encodeURIComponent(username)}`;

  if (pathname === prefix || pathname === `${prefix}/`) {
    return 'about';
  }

  if (pathname.startsWith(`${prefix}/`)) {
    const suffix = pathname.slice(prefix.length + 1);

    if (suffix === 'overview') {
      return 'overview';
    }

    if (suffix === 'accommodation') {
      return 'accommodation';
    }

    if (suffix === 'contacts') {
      return 'contacts';
    }

    if (suffix === 'tribes') {
      return 'tribes';
    }

    if (suffix === 'experiences/new') {
      return 'experiences-new';
    }

    if (suffix === 'experiences') {
      return 'experiences';
    }
  }

  return 'about';
}

export function getProfileViewTabStateName(pathname, username) {
  const tab = getProfileViewTab(pathname, username);

  return PROFILE_VIEW_TAB_STATE_NAMES[tab];
}

export function getProfileEditTab(pathname) {
  if (pathname === '/profile/edit' || pathname === '/profile/edit/') {
    return 'about';
  }

  if (pathname === '/profile/edit/locations') {
    return 'locations';
  }

  if (pathname === '/profile/edit/photo') {
    return 'photo';
  }

  if (pathname === '/profile/edit/networks') {
    return 'networks';
  }

  if (pathname === '/profile/edit/account') {
    return 'account';
  }

  return 'about';
}

export function getProfileEditTabPath(tab) {
  return PROFILE_EDIT_TAB_PATHS[tab] || PROFILE_EDIT_TAB_PATHS.about;
}

export function isMobileProfileViewport() {
  return window.innerWidth <= 480;
}

export function getMobileProfileRedirect(pathname, username) {
  const tab = getProfileViewTab(pathname, username);
  const prefix = `/profile/${encodeURIComponent(username)}`;

  if (isMobileProfileViewport()) {
    if (tab === 'about') {
      return `${prefix}/overview`;
    }

    return null;
  }

  if (tab === 'overview' || tab === 'accommodation') {
    return prefix;
  }

  return null;
}
