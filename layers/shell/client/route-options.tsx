import {
  type AnyRoute,
  useParams,
  useNavigate,
  useRouterState,
  useSearch,
} from '@tanstack/react-router';
import React from 'react';

import {
  REACT_ROUTE_POLICIES,
  toTanStackPath,
} from '@/modules/core/shared/react-route-ownership.mts';
import OfferShell from '@/modules/offers/client/components/OfferShell.component';
import { useAuth, type AuthUser } from '@/modules/core/client/react-app/auth';
import { guardFromPolicy, Route as rootRoute } from './routes/__root';

type RouteUser = AuthUser;
export type RouteContext = {
  user: RouteUser | null;
  currentPath: string;
  params: Record<string, string>;
  navigate?: (path: string) => void;
};
type ClientRoute = {
  path: string;
  render: (context: RouteContext) => React.ReactNode;
};
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
export type ShellRoute = RoutePolicy & ClientRoute;

export function renderWithUser(Component: React.ElementType) {
  return function renderRoute({ user }: RouteContext) {
    return React.createElement(Component, { user });
  };
}

export function renderOfferPage(Component: React.ElementType) {
  return function renderRoute({ user }: RouteContext) {
    return (
      <OfferShell user={user}>
        <Component user={user} />
      </OfferShell>
    );
  };
}

function createClientRouteComponent(clientRoute: ClientRoute) {
  function ClientRouteComponent() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const params = useParams({ strict: false });
    const search = useSearch({ strict: false });
    const currentPath = useRouterState({
      select: state => state.location.pathname,
    });
    const remountSearch = { ...search };

    // Selecting an offer updates the URL without resetting the map viewport.
    if (clientRoute.path === '/search') {
      delete remountSearch.offer;
    }

    return (
      <React.Fragment key={JSON.stringify({ params, search: remountSearch })}>
        {clientRoute.render({
          currentPath,
          params,
          user,
          navigate: path => {
            void navigate({ to: path });
          },
        })}
      </React.Fragment>
    );
  }

  return ClientRouteComponent;
}

function shellRoute(path: string, render: ShellRoute['render']): ShellRoute {
  const policy = (REACT_ROUTE_POLICIES as RoutePolicy[]).find(
    route => route.path === path,
  )!;
  return { ...policy, render };
}

// Options for a route under the root, guarded by the policy for its path.
export function routeOptions(path: string, render: ShellRoute['render']) {
  const route = shellRoute(path, render);
  return {
    beforeLoad: guardFromPolicy(route),
    component: createClientRouteComponent(route),
    getParentRoute: () => rootRoute,
    path: toTanStackPath(path),
    staticData: route,
  };
}

// Options for a route that the parent's component renders, such as a profile tab.
export function childRouteOptions<TParent extends AnyRoute>(
  path: string,
  parent: TParent,
) {
  const parentRoute = parent.options.staticData as ShellRoute;
  const route = shellRoute(path, parentRoute.render);
  return {
    beforeLoad: guardFromPolicy(route),
    getParentRoute: () => parent,
    path: toTanStackPath(path.slice(parentRoute.path.length + 1)),
    staticData: route,
  };
}
