import { createFileRoute } from '@tanstack/react-router';
import HomeRoute from '@/modules/pages/client/components/HomeRoute';
import { routeOptions, withUser } from '../route-options';

export const Route = createFileRoute('/about')(
  routeOptions(
    { title: 'About', footerHidden: true, redirectTo: '/' },
    withUser(HomeRoute),
  ),
);
