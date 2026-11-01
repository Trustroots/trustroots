import { createRoute } from '@tanstack/react-router';
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

export const Route = createRoute(
  routeOptions('/navigation', renderWithUser(NavigationRoute)),
);
