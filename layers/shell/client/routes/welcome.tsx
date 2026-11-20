import { createFileRoute } from '@tanstack/react-router';
import Welcome from '@/modules/users/client/components/Welcome.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/welcome')(
  routeOptions(
    { title: 'Welcome', requiresAuth: true, footerHidden: true },
    Welcome,
  ),
);
