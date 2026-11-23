import {
  type AnyRouter,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { createMiddleware } from '@tanstack/react-start';

import ShellDocument from './ShellDocument';

declare module '@tanstack/react-start' {
  interface Register {
    server: {
      requestContext: {
        express?: (request: Request) => Response | Promise<Response>;
      };
    };
  }
}

/**
 * Start routes win; for any other request the production server's
 * `context.express` returns the response that hands it to Express. Without
 * it, as when the shell is prerendered, Start renders the shell.
 */
const expressFallback = createMiddleware().server(
  ({ context, request, next }) => {
    const { express } = context;
    return express ? express(request) : next();
  },
);

/**
 * The server gets the bare document for every path and never imports
 * browser-only page modules.
 */
export async function createStartRouter(server: boolean): Promise<AnyRouter> {
  if (server) {
    const rootRoute = createRootRoute({
      shellComponent: ShellDocument,
      // Match ClientOnly's empty first render without an Outlet's Suspense
      // boundaries, which would otherwise disagree during hydration.
      component: () => null,
    });
    const anyPath = createRoute({
      getParentRoute: () => rootRoute,
      path: '$',
      server: { middleware: [expressFallback] },
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
