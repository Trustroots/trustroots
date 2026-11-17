import { HeadContent, Scripts } from '@tanstack/react-router';
import React, { type ReactNode } from 'react';

/**
 * The document TanStack Start prerenders as the SPA shell. Express adds the
 * page head, bootstrap data and script nonces before sending it.
 */
export default function ShellDocument({ children }: { children: ReactNode }) {
  return (
    // i18n sets the text direction before the shell hydrates.
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
