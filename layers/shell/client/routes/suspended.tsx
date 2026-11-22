import { createFileRoute } from '@tanstack/react-router';
import SuspendedPage from '@/modules/users/client/components/SuspendedPage.component';

export const Route = createFileRoute('/suspended')({
  staticData: {
    title: 'Account suspended',
    footerHidden: true,
    headerHidden: true,
  },
  component: SuspendedPage,
});
