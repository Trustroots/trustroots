import { createFileRoute } from '@tanstack/react-router';
import ForgotPasswordPage from '@/modules/users/client/components/ForgotPasswordPage.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/password/forgot')(
  routeOptions(
    { title: 'Reset password', footerVariant: 'account' },
    ForgotPasswordPage,
  ),
);
