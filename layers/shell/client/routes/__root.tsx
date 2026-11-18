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
import ReactAppShell from '../ReactAppShell';

export const Route = createRootRouteWithContext<{ user: AuthUser | null }>()({
  beforeLoad: ({ context, location }) => {
    const route = getReactRoutePolicy(location.href);
    const to =
      route?.redirectTo ||
      getReactRouteAccessRedirect(route, context.user, location.href) ||
      (!route && '/not-found');
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
  head: () => ({ meta: [{ title: window.title || 'Trustroots' }] }),
  notFoundComponent: NotFoundPage,
});
