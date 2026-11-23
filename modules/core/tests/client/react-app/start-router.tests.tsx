import React from 'react';
import { RouterProvider } from '@tanstack/react-router';
import { renderToString } from 'react-dom/server';

import ShellDocument from '@/layers/shell/client/ShellDocument';
// Load the real route tree during module setup, before the test timer starts.
import '@/layers/shell/client/router';
import {
  createStartRouter,
  getRouter,
} from '@/layers/shell/client/start-router';

describe('TanStack Start router entry', () => {
  it('gives the server only the shell document, for every path', async () => {
    const router = await createStartRouter(true);

    expect(router.routeTree.options).toHaveProperty(
      'shellComponent',
      ShellDocument,
    );
    expect(Object.keys(router.routesById)).toEqual(['__root__', '/$']);
    expect(router.options.trailingSlash).toBe('preserve');
    expect(router.matchRoutes('/assets/').map(match => match.routeId)).toEqual([
      '__root__',
      '/$',
    ]);
  });

  it('hands every path to Express when the server passes it', async () => {
    const router = await createStartRouter(true);
    expect(router.matchRoutes('/').map(match => match.routeId)).toEqual([
      '__root__',
      '/$',
    ]);
    const { middleware } = router.routesById['/$'].options.server as {
      middleware: { options: { server: (ctx: object) => unknown } }[];
    };
    const [fallback] = middleware;
    const request = new Request('http://localhost/api/languages');
    const response = new Response('from Express');
    const express = vi.fn(() => response);
    const next = vi.fn();

    expect(
      fallback.options.server({ context: { express }, request, next }),
    ).toBe(response);
    expect(express).toHaveBeenCalledWith(request);
    expect(next).not.toHaveBeenCalled();

    fallback.options.server({ context: {}, request, next });
    expect(next).toHaveBeenCalledOnce();
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

    expect(router.routeTree.options).toHaveProperty(
      'shellComponent',
      ShellDocument,
    );
    expect(router.routesById).toHaveProperty('/signin');
    expect(router.routesById).toHaveProperty('/profile/$username');
  });
});
