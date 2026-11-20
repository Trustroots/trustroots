import { createFileRoute } from '@tanstack/react-router';
import RemoveProfilePage from '@/modules/users/client/components/RemoveProfilePage.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/remove/$token')(
  routeOptions(
    {
      title: 'Remove profile',
      requiresAuth: true,
      headerHidden: true,
      footerHidden: true,
    },
    RemoveProfilePage,
  ),
);
