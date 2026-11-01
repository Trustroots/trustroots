import { createRootRoute } from '@tanstack/react-router';

import NotFoundPage from '@/modules/core/client/components/NotFoundPage.component';
import ReactAppShell from '../ReactAppShell';

export const Route = createRootRoute({
  component: ReactAppShell,
  notFoundComponent: NotFoundPage,
});
