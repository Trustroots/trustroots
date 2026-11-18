import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import React, { useEffect, useMemo, useRef } from 'react';

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

  // Guards and loaders depend on who the member is, so rerun them when that changes.
  const identity = user && `${user._id}:${user.roles?.join(',')}`;
  const loadedIdentity = useRef(identity);
  useEffect(() => {
    if (identity !== loadedIdentity.current) {
      loadedIdentity.current = identity;
      void router.invalidate();
    }
  }, [identity, router]);

  return (
    <QueryClientProvider client={router.options.context.queryClient}>
      <RouterProvider context={{ user }} router={router} />
    </QueryClientProvider>
  );
}
