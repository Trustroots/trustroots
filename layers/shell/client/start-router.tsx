import {
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';

import ShellDocument from './ShellDocument';

/**
 * The server only prerenders the SPA shell, so it gets the bare document for
 * every path and never imports browser-only page modules.
 */
export async function createStartRouter(server: boolean) {
  if (server) {
    const rootRoute = createRootRoute({ shellComponent: ShellDocument });
    const anyPath = createRoute({
      getParentRoute: () => rootRoute,
      path: '$',
    });
    return createRouter({
      routeTree: rootRoute.addChildren([anyPath]),
      // Vite's preview server, which prerenders the shell, only passes
      // requests under the /assets/ base.
      trailingSlash: 'preserve',
    });
  }
  const { createAppRouter } = await import('./router');
  const router = createAppRouter();
  Object.assign(router.routeTree.options, { shellComponent: ShellDocument });
  return router;
}

/** TanStack Start's router entry. */
export function getRouter() {
  return createStartRouter(typeof document === 'undefined');
}
