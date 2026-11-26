import { type AnyRouter, redirect } from '@tanstack/react-router';
import React from 'react';

import { type AuthUser, useAuth } from '@trustroots/core/auth';

export type RouteChrome = {
  title: string;
  footerHidden?: boolean;
  footerVariant?: string;
  headerHidden?: boolean;
  noScrollingTop?: boolean;
};

declare module '@tanstack/react-router' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- module augmentation needs an interface
  interface StaticDataRouteOption extends Partial<RouteChrome> {}
}

type GuardOptions = {
  context: { user: Pick<AuthUser, 'roles'> | null | undefined };
  location: { href: string };
};

export function requireAuth({ context, location }: GuardOptions) {
  if (!context.user) {
    throw redirect({
      href: `/signin?continue=true&returnTo=${encodeURIComponent(location.href)}`,
    });
  }
}

export function requireRole(...roles: string[]) {
  return (options: GuardOptions) => {
    requireAuth(options);
    if (!roles.some(role => options.context.user?.roles?.includes(role))) {
      throw redirect({ href: '/volunteering' });
    }
  };
}

export function redirectTo(href: string) {
  return () => {
    throw redirect({ href });
  };
}

export function withUser(Component: React.ElementType) {
  return function RouteWithUser() {
    const { user } = useAuth();
    return <Component user={user} />;
  };
}

// The app route for a path; unknown paths only partly match.
export function matchAppRoute(router: AnyRouter, pathname: string) {
  const matches = router.matchRoutes(pathname);
  const match = matches[matches.length - 1];
  return match?.staticData?.title && !matches.some(m => m._notFound)
    ? match
    : undefined;
}

// The route's path in `/profile/:username` form.
export function routeTemplate(router: AnyRouter, pathname: string) {
  return matchAppRoute(router, pathname)
    ?.fullPath.replace(/(.)\/$/, '$1')
    .replace(/\$(\w+)/g, ':$1');
}
