import { createFileRoute } from '@tanstack/react-router';
import SearchPage from '@/modules/search/client/components/SearchPage.component';
import { routeOptions, withUser } from '../route-options';

export const Route = createFileRoute('/search/')({
  ...routeOptions(
    { title: 'Search', requiresAuth: true, footerHidden: true },
    withUser(SearchPage),
  ),
  // Selecting an offer updates the URL without resetting the map viewport.
  remountDeps: ({ params, search }) => ({
    params,
    search: { ...search, offer: undefined },
  }),
});
