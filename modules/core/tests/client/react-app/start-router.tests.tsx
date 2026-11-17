import React from 'react';
import { RouterProvider } from '@tanstack/react-router';
import { renderToString } from 'react-dom/server';

import ShellDocument from '@/layers/shell/client/ShellDocument';
import {
  createStartRouter,
  getRouter,
} from '@/layers/shell/client/start-router';

describe('TanStack Start router entry', () => {
  it('gives the server only the shell document, for every path', async () => {
    const router = await createStartRouter(true);

    expect(router.routeTree.options.shellComponent).toBe(ShellDocument);
    expect(Object.keys(router.routesById)).toEqual(['__root__', '/$']);
    expect(router.options.trailingSlash).toBe('preserve');
    expect(router.matchRoutes('/assets/').map(match => match.routeId)).toEqual([
      '__root__',
      '/$',
    ]);
  });

  it('renders the shell as a whole document with Start scripts', async () => {
    const router = await createStartRouter(true);
    await router.load();

    const html = renderToString(<RouterProvider router={router} />);

    expect(html).toMatch(/^<html lang="en"><head>.*<\/head><body>/);
    expect(html).toContain('<div id="tr-react-root">');
    expect(html).toMatch(/<\/body><\/html>$/);
  });

  it('gives the browser the app routes inside the shell document', async () => {
    const router = await getRouter();

    expect(router.routeTree.options.shellComponent).toBe(ShellDocument);
    expect(router.routesById).toHaveProperty('/signin');
    expect(router.routesById).toHaveProperty('/profile/$username');
  });
});
