import { createFileRoute } from '@tanstack/react-router';
import SignupPage from '@/modules/users/client/components/SignupPage.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/signup')(
  routeOptions(
    { title: 'Sign up', headerHidden: true, footerVariant: 'account' },
    SignupPage,
  ),
);
