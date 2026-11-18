import { ClientOnly, createRootRoute } from '@tanstack/react-router';
import React from 'react';

import NotFoundPage from '@/modules/core/client/components/NotFoundPage.component';
import ReactAppShell from '../ReactAppShell';

export const Route = createRootRoute({
  // The prerendered SPA shell has an empty body; render after hydration.
  component: () => (
    <ClientOnly>
      <ReactAppShell />
    </ClientOnly>
  ),
  notFoundComponent: NotFoundPage,
});
