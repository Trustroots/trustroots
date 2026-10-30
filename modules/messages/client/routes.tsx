import React from 'react';

import { useSettings } from '@/modules/core/client/react-app/app-context';
import {
  renderWithUser,
  type RouteContext,
  type RouteRender,
} from '@/modules/core/client/react-app/route-render';
import Inbox from '@/modules/messages/client/components/Inbox.component';
import Thread from '@/modules/messages/client/components/Thread.component';

function ThreadRoute({ user }: RouteContext) {
  if (!user) return null;

  /* istanbul ignore next -- app settings always provide this default in production. */
  const { profileMinimumLength = 140 } = useSettings();

  return (
    <Thread
      profileMinimumLength={profileMinimumLength as number}
      user={user as React.ComponentProps<typeof Thread>['user']}
    />
  );
}

export const messagesRoutes: Record<string, RouteRender> = {
  '/messages': renderWithUser(Inbox),
  '/messages/:username': renderWithUser(ThreadRoute),
};
