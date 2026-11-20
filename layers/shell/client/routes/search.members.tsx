import { createFileRoute } from '@tanstack/react-router';
import SearchUsers from '@/modules/search/client/components/SearchUsers.component';
import { requireAuth } from '../route-options';

export const Route = createFileRoute('/search/members')({
  staticData: { title: 'Search members', footerHidden: true },
  beforeLoad: requireAuth,
  component: SearchUsers,
});
