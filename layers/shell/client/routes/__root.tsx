import {
  ClientOnly,
  createRootRouteWithContext,
  redirect,
} from '@tanstack/react-router';
import React from 'react';

import NotFoundPage from '@/modules/core/client/components/NotFoundPage.component';
import type { AuthUser } from '@/modules/core/client/react-app/auth';
import {
  getReactRouteAccessRedirect,
  getReactRoutePolicy,
} from '@/modules/core/shared/react-route-ownership.mts';
import { getBootstrapData } from '../bootstrap';
import ReactAppShell from '../ReactAppShell';

export const Route = createRootRouteWithContext<{ user: AuthUser | null }>()({
  beforeLoad: ({ context, location }) => {
    const route = getReactRoutePolicy(location.pathname);
    const to =
      route?.redirectTo ||
      getReactRouteAccessRedirect(route, context.user, location.href);
    if (to) {
      throw redirect({ href: to });
    }
  },
  // The prerendered SPA shell has an empty body; render after hydration.
  component: () => (
    <ClientOnly>
      <ReactAppShell />
    </ClientOnly>
  ),
  head: () => ({ meta: [{ title: getBootstrapData().title }] }),
  notFoundComponent: NotFoundPage,
  // Remount dependencies only see validated query parameters, so pass them all on.
  validateSearch: (search: Record<string, unknown>) => search,
});
