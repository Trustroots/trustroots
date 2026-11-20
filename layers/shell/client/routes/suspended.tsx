import { createFileRoute } from '@tanstack/react-router';
import SuspendedPage from '@/modules/users/client/components/SuspendedPage.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/suspended')(
  routeOptions(
    { title: 'Account suspended', footerHidden: true, headerHidden: true },
    SuspendedPage,
  ),
);
