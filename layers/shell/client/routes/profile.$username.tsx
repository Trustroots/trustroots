import { createFileRoute } from '@tanstack/react-router';
import React from 'react';
import ProfilePage from '@/modules/users/client/components/ProfilePage.component';
import { routeOptions, type RouteContext } from '../route-options';

function renderProfile({ currentPath, user }: RouteContext) {
  return (
    <ProfilePage
      currentPath={currentPath}
      user={user as React.ComponentProps<typeof ProfilePage>['user']}
    />
  );
}

export const Route = createFileRoute('/profile/$username')(
  routeOptions('/profile/:username', renderProfile),
);
