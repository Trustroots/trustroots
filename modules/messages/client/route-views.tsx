import React from 'react';
import Thread from './components/Thread.component';
import { useSettings } from '@/modules/core/client/react-app/app-context';
import { useAuth } from '@/modules/core/client/react-app/auth';

export function ThreadRoute({
  ReferencePanel,
}: Pick<React.ComponentProps<typeof Thread>, 'ReferencePanel'>) {
  const { user } = useAuth();
  /* istanbul ignore next -- app settings always provide this default in production. */
  const { profileMinimumLength = 140 } = useSettings();

  if (!user) return null;

  return (
    <Thread
      ReferencePanel={ReferencePanel}
      profileMinimumLength={profileMinimumLength as number}
      user={user as React.ComponentProps<typeof Thread>['user']}
    />
  );
}
