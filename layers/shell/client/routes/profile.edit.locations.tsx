import { createRoute } from '@tanstack/react-router';
import ProfileEditLocations from '@/modules/users/client/components/ProfileEditLocations.component';
import { routeOptions, renderWithUser } from '../route-options';

export const Route = createRoute(
  routeOptions('/profile/edit/locations', renderWithUser(ProfileEditLocations)),
);
