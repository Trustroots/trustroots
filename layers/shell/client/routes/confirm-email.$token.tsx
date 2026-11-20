import { createFileRoute } from '@tanstack/react-router';
import ConfirmEmailPage from '@/modules/users/client/components/ConfirmEmailPage.component';

export const Route = createFileRoute('/confirm-email/$token')({
  staticData: { title: 'Confirm email' },
  component: ConfirmEmailPage,
});
