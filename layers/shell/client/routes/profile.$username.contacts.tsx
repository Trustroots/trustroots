import { createFileRoute } from '@tanstack/react-router';
import { childRouteOptions } from '../route-options';
import { Route as ProfileUsernameRoute } from './profile.$username';

export const Route = createFileRoute('/profile/$username/contacts')(
  childRouteOptions('/profile/:username/contacts', ProfileUsernameRoute),
);
