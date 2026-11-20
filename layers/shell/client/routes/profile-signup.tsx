import { createFileRoute } from '@tanstack/react-router';
import ProfileSignupPage from '@/modules/users/client/components/ProfileSignupPage.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/profile-signup')(
  routeOptions('/profile-signup', ProfileSignupPage),
);
