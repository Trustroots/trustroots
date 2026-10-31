import {
  type AnyRoute,
  useParams,
  useNavigate,
  useRouterState,
  useSearch,
} from '@tanstack/react-router';
import React from 'react';

import {
  toTanStackPath,
  type ReactRoutePolicy,
} from '@/modules/core/shared/react-route-ownership.mts';
import { REACT_ROUTE_POLICIES } from '@/layers/shell/shared/route-manifest.mts';
import { useAuth } from '@/modules/core/client/react-app/auth';
import type { RouteRender } from '@/modules/core/client/react-app/route-render';
import { guardFromPolicy, Route as rootRoute } from './routes/__root';

type ClientRoute = { path: string; render: RouteRender };
export type ShellRoute = ReactRoutePolicy & ClientRoute;

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

function shellRoute(path: string, render: RouteRender): ShellRoute {
  const policy = REACT_ROUTE_POLICIES.find(route => route.path === path)!;
  return { ...policy, render };
}

// Options for a route under the root, guarded by the policy for its path.
export function routeOptions(path: string, render: RouteRender) {
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
