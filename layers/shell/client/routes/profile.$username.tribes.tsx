import { createRoute } from '@tanstack/react-router';
import { childRouteOptions } from '../route-options';
import { Route as ProfileUsernameRoute } from './profile.$username';

export const Route = createRoute(
  childRouteOptions('/profile/:username/tribes', ProfileUsernameRoute),
);
