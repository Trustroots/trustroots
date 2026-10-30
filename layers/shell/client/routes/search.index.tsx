import { createRoute } from '@tanstack/react-router';
import SearchPage from '@/modules/search/client/components/SearchPage.component';
import { routeOptions, renderWithUser } from '../route-options';

export const Route = createRoute(
  routeOptions('/search', renderWithUser(SearchPage)),
);
