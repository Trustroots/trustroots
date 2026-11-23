import { createFileRoute } from '@tanstack/react-router';
import SearchPage from '@/modules/search/client/components/SearchPage.component';
import { requireAuth, withUser } from '../route-options';

export const Route = createFileRoute('/search/')({
  staticData: { title: 'Search', footerHidden: true },
  beforeLoad: requireAuth,
  component: withUser(SearchPage),
  // Search state updates the URL while keeping the live map mounted.
  remountDeps: () => undefined,
});
