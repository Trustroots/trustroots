import { RouterProvider } from '@tanstack/react-router';
import React, { useMemo } from 'react';

import { createAppRouter } from './routes';

export { defaultNavigate, signout } from './shell-helpers';

export default function ReactApp({
  navigate,
}: {
  navigate?: (target: string) => void;
}) {
  const router = useMemo(() => createAppRouter(), []);

  return (
    <RouterProvider context={{ navigateOverride: navigate }} router={router} />
  );
}
