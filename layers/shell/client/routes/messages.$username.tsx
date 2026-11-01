import { createRoute } from '@tanstack/react-router';
import React from 'react';
import Thread from '@/modules/messages/client/components/Thread.component';
import { useSettings } from '@/modules/core/client/react-app/app-context';
import {
  routeOptions,
  renderWithUser,
  type RouteContext,
} from '../route-options';

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

export const Route = createRoute(
  routeOptions('/messages/:username', renderWithUser(ThreadRoute)),
);
