import { RouterProvider } from '@tanstack/react-router';
import React, { useMemo } from 'react';

import useUnreadMessageCountPolling from '@/modules/messages/client/services/use-unread-message-count-polling';
import { createAppRouter } from './router';

export default function ReactApp({
  navigate,
  router: startRouter,
}: {
  navigate?: (target: string) => void;
  router?: ReturnType<typeof createAppRouter>;
}) {
  const router = useMemo(() => startRouter ?? createAppRouter(), [startRouter]);
  useUnreadMessageCountPolling();

  return (
    <RouterProvider context={{ navigateOverride: navigate }} router={router} />
  );
}
