import { ClientOnly, createRootRouteWithContext } from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import React from 'react';

import NotFoundPage from '@/modules/core/client/components/NotFoundPage.component';
import type { AuthUser } from '@/modules/core/client/react-app/auth';
import { getBootstrapData } from '../bootstrap';
import ReactAppShell from '../ReactAppShell';

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  user: AuthUser | null;
}>()({
  // The prerendered SPA shell has an empty body; render after hydration.
  component: () => (
    <ClientOnly>
      <ReactAppShell />
    </ClientOnly>
  ),
  head: ({ matches }) => {
    const title = matches[matches.length - 1]?.staticData.title;
    return {
      meta: [
        { title: title ? `${title} - Trustroots` : getBootstrapData().title },
      ],
    };
  },
  notFoundComponent: NotFoundPage,
  // Remount dependencies only see validated query parameters, so pass them all on.
  validateSearch: (search: Record<string, unknown>) => search,
});
