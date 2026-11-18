import { createFileRoute } from '@tanstack/react-router';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/profile/$username/contacts')(
  routeOptions('/profile/:username/contacts'),
);
