import { RouterProvider } from '@tanstack/react-router';
import React, { useMemo } from 'react';

import useUnreadMessageCountPolling from '@/modules/messages/client/services/use-unread-message-count-polling';
import { createAppRouter } from './routes';

export default function ReactApp({
  navigate,
}: {
  navigate?: (target: string) => void;
}) {
  const router = useMemo(() => createAppRouter(), []);
  useUnreadMessageCountPolling();

  return (
    <RouterProvider context={{ navigateOverride: navigate }} router={router} />
  );
}
