import { createRoute } from '@tanstack/react-router';
import ProfileEditNetworks from '@/modules/users/client/components/ProfileEditNetworks.component';
import { routeOptions, renderWithUser } from '../route-options';

export const Route = createRoute(
  routeOptions('/profile/edit/networks', renderWithUser(ProfileEditNetworks)),
);
