import { createFileRoute } from '@tanstack/react-router';
import ResetPasswordPage from '@/modules/users/client/components/ResetPasswordPage.component';

export const Route = createFileRoute('/password/reset/$token')({
  staticData: { title: 'Reset password', footerVariant: 'account' },
  component: ResetPasswordPage,
});
