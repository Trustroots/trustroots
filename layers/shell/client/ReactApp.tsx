import { RouterProvider } from '@tanstack/react-router';
import React, { useEffect, useMemo } from 'react';

import { useAuth } from '@/modules/core/client/react-app/auth';
import useUnreadMessageCountPolling from '@/modules/messages/client/services/use-unread-message-count-polling';
import { createAppRouter } from './router';

export default function ReactApp({
  router: startRouter,
}: {
  router?: ReturnType<typeof createAppRouter>;
}) {
  const router = useMemo(() => startRouter ?? createAppRouter(), [startRouter]);
  const { user } = useAuth();
  useUnreadMessageCountPolling();

  // Route guards run in beforeLoad, so check them again when the member changes.
  useEffect(() => {
    void router.invalidate();
  }, [router, user]);

  return <RouterProvider context={{ user }} router={router} />;
}
