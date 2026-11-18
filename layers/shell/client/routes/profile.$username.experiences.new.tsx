import { createFileRoute } from '@tanstack/react-router';
import { childRouteOptions } from '../route-options';
import { Route as ProfileUsernameRoute } from './profile.$username';

export const Route = createFileRoute('/profile/$username/experiences/new')(
  childRouteOptions('/profile/:username/experiences/new', ProfileUsernameRoute),
);
