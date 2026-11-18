import type { RouteComponent } from '@tanstack/react-router';
import React from 'react';

import { REACT_ROUTE_POLICIES } from '@/modules/core/shared/react-route-ownership.mts';
import { useAuth } from '@/modules/core/client/react-app/auth';

export type RoutePolicy = {
  path: string;
  title: string;
  footerHidden?: boolean;
  footerVariant?: string;
  headerHidden?: boolean;
  redirectTo?: string;
  requiresAuth?: boolean;
  requiresRole?: string;
  [key: string]: unknown;
};

export function withUser(Component: React.ElementType) {
  return function RouteWithUser() {
    const { user } = useAuth();
    return <Component user={user} />;
  };
}

// Options for a route, with the policy for its path.
export function routeOptions(path: string, component?: RouteComponent) {
  const route = (REACT_ROUTE_POLICIES as RoutePolicy[]).find(
    policy => policy.path === path,
  )!;
  return {
    component,
    head: () => ({ meta: [{ title: `${route.title} - Trustroots` }] }),
    remountDeps: ({ params, search }: { params: object; search: object }) => ({
      params,
      search,
    }),
    staticData: route,
  };
}
