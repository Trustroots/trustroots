import {
  ClientOnly,
  createRootRouteWithContext,
  redirect,
} from '@tanstack/react-router';
import React from 'react';

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
      getReactRouteAccessRedirect(route, context.user, location.href) ||
      // Unknown paths and invalid circle slugs both resolve to the not-found policy.
      ((route?.path ?? '/not-found') === '/not-found' &&
        location.pathname !== '/not-found' &&
        '/not-found');
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
});
