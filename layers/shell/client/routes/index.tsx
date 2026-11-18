import { createFileRoute } from '@tanstack/react-router';
import HomeRoute from '@/modules/pages/client/components/HomeRoute';
import { routeOptions, renderWithUser } from '../route-options';

export const Route = createFileRoute('/')(
  routeOptions('/', renderWithUser(HomeRoute)),
);
