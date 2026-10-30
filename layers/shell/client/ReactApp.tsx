import { RouterProvider } from '@tanstack/react-router';
import React, { useEffect, useMemo, useRef } from 'react';

import { useAuth } from '@/modules/core/client/react-app/auth';
import useUnreadMessageCountPolling from '@/modules/messages/client/services/use-unread-message-count-polling';
import { createAppRouter } from './router';

export default function ReactApp({
  navigate,
}: {
  navigate?: (target: string) => void;
}) {
  const router = useMemo(() => createAppRouter(), []);
  useUnreadMessageCountPolling();
  const { user } = useAuth();
  const guardedUser = useRef(user);

  // Re-run the route guards when the member signs in, out or changes roles.
  useEffect(() => {
    if (guardedUser.current !== user) void router.invalidate();
    guardedUser.current = user;
  }, [router, user]);

  return (
    <RouterProvider
      context={{ navigateOverride: navigate, user }}
      router={router}
    />
  );
}
