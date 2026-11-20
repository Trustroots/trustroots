import {
  type AnyRouter,
  redirect,
  type RouteComponent,
} from '@tanstack/react-router';
import React from 'react';

import { type AuthUser, useAuth } from '@/modules/core/client/react-app/auth';

export type RoutePolicy = {
  title: string;
  footerHidden?: boolean;
  footerVariant?: string;
  headerHidden?: boolean;
  noScrollingTop?: boolean;
  redirectTo?: string;
  requiresAuth?: boolean;
  requiresRole?: readonly string[];
};

declare module '@tanstack/react-router' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- module augmentation needs an interface
  interface StaticDataRouteOption extends Partial<RoutePolicy> {}
}

type RouteUser = Pick<AuthUser, 'roles'> | null | undefined;
type GuardOptions = {
  context: { user: RouteUser };
  location: { href: string };
};

export function adminPolicy(
  title: string,
  requiresRole: readonly string[] = ['admin'],
): RoutePolicy {
  return { footerVariant: 'admin', requiresRole, title };
}

export function accessRedirect(
  policy: Partial<RoutePolicy>,
  user: RouteUser,
  returnTo: string,
): string | undefined {
  if (policy.redirectTo) return policy.redirectTo;
  if ((policy.requiresAuth || policy.requiresRole) && !user) {
    return `/signin?continue=true&returnTo=${encodeURIComponent(returnTo)}`;
  }
  if (
    policy.requiresRole &&
    !policy.requiresRole.some(role => user?.roles?.includes(role))
  ) {
    return '/volunteering';
  }
  return undefined;
}

export function guard(
  policy: Partial<RoutePolicy>,
  { context, location }: GuardOptions,
) {
  const to = accessRedirect(policy, context.user, location.href);
  if (to) throw redirect({ href: to });
}

export function withUser(Component: React.ElementType) {
  return function RouteWithUser() {
    const { user } = useAuth();
    return <Component user={user} />;
  };
}

export function routeOptions(policy: RoutePolicy, component?: RouteComponent) {
  return {
    beforeLoad: (options: GuardOptions) => guard(policy, options),
    component,
    head: () => ({ meta: [{ title: `${policy.title} - Trustroots` }] }),
    remountDeps: ({ params, search }: Record<'params' | 'search', object>) => ({
      params,
      search,
    }),
    staticData: policy,
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
