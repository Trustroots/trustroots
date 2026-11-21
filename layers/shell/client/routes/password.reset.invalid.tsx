import { createFileRoute } from '@tanstack/react-router';
import ResetPasswordInvalidPage from '@/modules/users/client/components/ResetPasswordInvalidPage.component';

export const Route = createFileRoute('/password/reset/invalid')({
  staticData: { title: 'Reset password', footerVariant: 'account' },
  component: ResetPasswordInvalidPage,
});
