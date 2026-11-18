import { createFileRoute } from '@tanstack/react-router';
import SigninPage from '@/modules/users/client/components/SigninPage.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/signin')(
  routeOptions('/signin', SigninPage),
);
