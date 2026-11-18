import {
  type AnyRoute,
  useParams,
  useNavigate,
  useRouterState,
  useSearch,
} from '@tanstack/react-router';
import React from 'react';

import { REACT_ROUTE_POLICIES } from '@/modules/core/shared/react-route-ownership.mts';
import OfferShell from '@/modules/offers/client/components/OfferShell.component';
import { useAuth, type AuthUser } from '@/modules/core/client/react-app/auth';

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

function policyOptions(path: string, render: ShellRoute['render']) {
  const route = shellRoute(path, render);
  return {
    head: () => ({ meta: [{ title: `${route.title} - Trustroots` }] }),
    staticData: route,
  };
}

// Options for a route, with the policy for its path.
export function routeOptions(path: string, render: ShellRoute['render']) {
  const options = policyOptions(path, render);
  return {
    ...options,
    component: createClientRouteComponent(options.staticData),
  };
}

// Options for a route that the parent's component renders, such as a profile tab.
export function childRouteOptions(path: string, parent: AnyRoute) {
  return policyOptions(path, (parent.options.staticData as ShellRoute).render);
}
