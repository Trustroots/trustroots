import { createFileRoute } from '@tanstack/react-router';
import ConfirmEmailInvalidPage from '@/modules/users/client/components/ConfirmEmailInvalidPage.component';

export const Route = createFileRoute('/confirm-email-invalid')({
  staticData: { title: 'Confirm email invalid' },
  component: ConfirmEmailInvalidPage,
});
