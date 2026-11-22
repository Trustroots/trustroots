import { createFileRoute } from '@tanstack/react-router';
import ForgotPasswordPage from '@/modules/users/client/components/ForgotPasswordPage.component';

export const Route = createFileRoute('/password/forgot')({
  staticData: { title: 'Reset password', footerVariant: 'account' },
  component: ForgotPasswordPage,
});
