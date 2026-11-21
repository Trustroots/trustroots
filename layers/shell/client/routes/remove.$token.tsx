import { createFileRoute } from '@tanstack/react-router';
import RemoveProfilePage from '@/modules/users/client/components/RemoveProfilePage.component';
import { requireAuth } from '../route-options';

export const Route = createFileRoute('/remove/$token')({
  staticData: {
    title: 'Remove profile',
    headerHidden: true,
    footerHidden: true,
  },
  beforeLoad: requireAuth,
  component: RemoveProfilePage,
});
