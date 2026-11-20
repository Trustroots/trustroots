import { createFileRoute } from '@tanstack/react-router';
import ResetPasswordSuccessPage from '@/modules/users/client/components/ResetPasswordSuccessPage.component';

export const Route = createFileRoute('/password/reset/success')({
  staticData: { title: 'Reset password', footerVariant: 'account' },
  component: ResetPasswordSuccessPage,
});
