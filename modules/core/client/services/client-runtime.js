import { matchReactRoute } from '@/modules/core/shared/react-route-ownership';

const STATE_TARGETS = {
  home: '/',
  inbox: '/messages',
  navigation: '/navigation',
  welcome: '/welcome',
  'circles.list': '/circles',
  search: '/search',
  'search.map': '/search',
  'search-users': '/search/members',
  signin: '/signin',
  signup: '/signup',
  forgot: '/password/forgot',
  'reset-success': '/password/reset/success',
  'reset-invalid': '/password/reset/invalid',
  'profile-edit.about': '/profile/edit',
  'profile-edit.account': '/profile/edit/account',
  'profile-signup': '/profile-signup',
};

/* istanbul ignore next -- callers without parameters use the browser navigation path. */
function appendQueryParams(path, params = {}) {
  const url = new URL(path, window.location.origin);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });

  return `${url.pathname}${url.search}${url.hash}`;
}

export function resolveNavigationTarget(to, params = {}) {
  if (typeof to === 'string' && to.startsWith('/')) {
    return appendQueryParams(to, params);
  }

  if (typeof to === 'string' && STATE_TARGETS[to]) {
    return appendQueryParams(STATE_TARGETS[to], params);
  }

  if (to === 'circles.circle' && params?.circle) {
    return `/circles/${encodeURIComponent(params.circle)}`;
  }

  if (to === 'messageThread' && params?.username) {
    return appendQueryParams(
      `/messages/${encodeURIComponent(params.username)}`,
      params,
    );
  }

  return null;
}

/* istanbul ignore next -- the implicit browser location is exercised in browser tests. */
export function navigate(to, params, options, location = window.location) {
  void options;

  const path = resolveNavigationTarget(to, params);

  if (!path) {
    return undefined;
  }

  if (typeof location.assign === 'function') {
    location.assign(path);
  } else {
    location.href = path;
  }

  return undefined;
}

export function getCurrentRouteParams(location = window.location) {
  const matched = matchReactRoute(location.pathname);
  const params = matched?.params ? { ...matched.params } : {};
  const searchParams = new URLSearchParams(location.search);

  searchParams.forEach((value, key) => {
    params[key] = value;
  });

  return params;
}

export function broadcastClientEvent(eventName, ...args) {
  return window.dispatchEvent(
    new CustomEvent(`tr:${eventName}`, {
      detail: args,
    }),
  );
}

export function onClientEvent(eventName, listener) {
  const eventListener = event => listener(null, ...(event.detail || []));

  window.addEventListener(`tr:${eventName}`, eventListener);

  return () => window.removeEventListener(`tr:${eventName}`, eventListener);
}

export function trackEvent(action, options = {}) {
  if (typeof window.ga === 'function') {
    window.ga(
      'send',
      'event',
      options.category || 'default',
      action,
      options.label,
    );
  }

  return undefined;
}

export function getCurrentUser() {
  return window.user || null;
}
