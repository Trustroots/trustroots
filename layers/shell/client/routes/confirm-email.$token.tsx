import { createFileRoute } from '@tanstack/react-router';
import ConfirmEmailPage from '@/modules/users/client/components/ConfirmEmailPage.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/confirm-email/$token')(
  routeOptions({ title: 'Confirm email' }, ConfirmEmailPage),
);
