import { createFileRoute } from '@tanstack/react-router';
import ResetPasswordSuccessPage from '@/modules/users/client/components/ResetPasswordSuccessPage.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/password/reset/success')(
  routeOptions(
    { title: 'Reset password', footerVariant: 'account' },
    ResetPasswordSuccessPage,
  ),
);
