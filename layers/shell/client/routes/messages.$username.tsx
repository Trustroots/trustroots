import { createFileRoute } from '@tanstack/react-router';
import React from 'react';
import Thread from '@/modules/messages/client/components/Thread.component';
import { useSettings } from '@trustroots/core/app-context';
import { useAuth } from '@trustroots/core/auth';
import { requireAuth } from '../route-options';

function ThreadRoute() {
  const { user } = useAuth();
  /* istanbul ignore next -- app settings always provide this default in production. */
  const { profileMinimumLength = 140 } = useSettings();

  if (!user) return null;

  return (
    <Thread
      profileMinimumLength={profileMinimumLength as number}
      user={user as React.ComponentProps<typeof Thread>['user']}
    />
  );
}

export const Route = createFileRoute('/messages/$username')({
  staticData: { title: 'Messages', footerHidden: true },
  beforeLoad: requireAuth,
  component: ThreadRoute,
});
