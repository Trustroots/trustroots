import { createFileRoute } from '@tanstack/react-router';
import SigninPage from '@/modules/users/client/components/SigninPage.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/signin')(
  routeOptions(
    { title: 'Sign in', headerHidden: true, footerVariant: 'account' },
    SigninPage,
  ),
);
