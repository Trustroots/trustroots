import { matchReactRoute } from '@/modules/core/shared/react-route-ownership';
import { navigateTo } from '@/modules/core/client/react-app/shell-helpers';

const STATE_TARGETS: Record<string, string> = {
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

type NavigationParams = Record<
  string,
  string | number | boolean | null | undefined
>;
type NavigateOptions = { reload?: boolean };

/* istanbul ignore next -- callers without parameters use the browser navigation path. */
function appendQueryParams(
  path: string,
  params: NavigationParams = {},
): string {
  const url = new URL(path, window.location.origin);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });

  return `${url.pathname}${url.search}${url.hash}`;
}

export function resolveNavigationTarget(
  to: string,
  params: NavigationParams = {},
): string | null {
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
export function navigate(
  to: string,
  params?: NavigationParams,
  options?: NavigateOptions,
  location: Location = window.location,
): undefined {
  const path = resolveNavigationTarget(to, params);

  if (!path) {
    return undefined;
  }

  if (options?.reload) {
    if (typeof location.assign === 'function') {
      location.assign(path);
    } else {
      location.href = path;
    }

    return undefined;
  }

  navigateTo(path, location);

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

export function broadcastClientEvent(
  eventName: string,
  ...args: unknown[]
): boolean {
  return window.dispatchEvent(
    new CustomEvent(`tr:${eventName}`, {
      detail: args,
    }),
  );
}

export function onClientEvent(
  eventName: string,
  listener: (error: null, ...args: unknown[]) => void,
): () => void {
  const eventListener = (event: Event) =>
    listener(null, ...((event as CustomEvent<unknown[]>).detail || []));

  window.addEventListener(`tr:${eventName}`, eventListener);

  return () => window.removeEventListener(`tr:${eventName}`, eventListener);
}

export function trackEvent(
  action: string,
  options: { category?: string; label?: string; value?: string | number } = {},
): undefined {
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

export function getCurrentUser(): NonNullable<Window['user']> | null {
  return window.user || null;
}
