import { createFileRoute } from '@tanstack/react-router';
import React from 'react';
import Navigation from '@/modules/pages/client/components/Navigation.component';
import {
  routeOptions,
  renderWithUser,
  type RouteContext,
} from '../route-options';

function NavigationRoute({ user }: RouteContext) {
  return (
    <Navigation
      user={user as React.ComponentProps<typeof Navigation>['user']}
    />
  );
}

export const Route = createFileRoute('/navigation')(
  routeOptions('/navigation', renderWithUser(NavigationRoute)),
);
