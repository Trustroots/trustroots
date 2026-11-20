import { createFileRoute } from '@tanstack/react-router';
import Navigation from '@/modules/pages/client/components/Navigation.component';
import { routeOptions, withUser } from '../route-options';

export const Route = createFileRoute('/navigation')(
  routeOptions('/navigation', withUser(Navigation)),
);
