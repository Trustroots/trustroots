import { createFileRoute } from '@tanstack/react-router';
import NotFoundPage from '@/modules/core/client/components/NotFoundPage.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/not-found')(
  routeOptions(
    { title: 'Not found', footerVariant: 'account', headerHidden: true },
    NotFoundPage,
  ),
);
