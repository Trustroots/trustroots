import { createFileRoute } from '@tanstack/react-router';
import SignupPage from '@/modules/users/client/components/SignupPage.component';

export const Route = createFileRoute('/signup')({
  staticData: {
    title: 'Sign up',
    headerHidden: true,
    footerVariant: 'account',
  },
  component: SignupPage,
});
