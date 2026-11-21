import { createFileRoute } from '@tanstack/react-router';
import SigninPage from '@/modules/users/client/components/SigninPage.component';

export const Route = createFileRoute('/signin')({
  staticData: {
    title: 'Sign in',
    headerHidden: true,
    footerVariant: 'account',
  },
  component: SigninPage,
});
