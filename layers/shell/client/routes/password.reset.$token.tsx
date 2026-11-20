import { createFileRoute } from '@tanstack/react-router';
import ResetPasswordPage from '@/modules/users/client/components/ResetPasswordPage.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/password/reset/$token')(
  routeOptions(
    { title: 'Reset password', footerVariant: 'account' },
    ResetPasswordPage,
  ),
);
