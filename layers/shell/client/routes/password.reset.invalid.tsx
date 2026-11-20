import { createFileRoute } from '@tanstack/react-router';
import ResetPasswordInvalidPage from '@/modules/users/client/components/ResetPasswordInvalidPage.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/password/reset/invalid')(
  routeOptions(
    { title: 'Reset password', footerVariant: 'account' },
    ResetPasswordInvalidPage,
  ),
);
