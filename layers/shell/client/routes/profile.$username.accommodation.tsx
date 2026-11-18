import { createFileRoute } from '@tanstack/react-router';
import { childRouteOptions } from '../route-options';
import { Route as ProfileUsernameRoute } from './profile.$username';

export const Route = createFileRoute('/profile/$username/accommodation')(
  childRouteOptions('/profile/:username/accommodation', ProfileUsernameRoute),
);
