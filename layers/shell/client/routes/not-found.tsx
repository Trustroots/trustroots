import { createFileRoute } from '@tanstack/react-router';
import NotFoundPage from '@/modules/core/client/components/NotFoundPage.component';

export const Route = createFileRoute('/not-found')({
  staticData: {
    title: 'Not found',
    footerVariant: 'account',
    headerHidden: true,
  },
  component: NotFoundPage,
});
