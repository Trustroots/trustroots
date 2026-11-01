import { createRoute } from '@tanstack/react-router';
import ProfileEditAccount from '@/modules/users/client/components/ProfileEditAccount.component';
import { routeOptions, renderWithUser } from '../route-options';

export const Route = createRoute(
  routeOptions('/profile/edit/account', renderWithUser(ProfileEditAccount)),
);
