import { createRoute } from '@tanstack/react-router';
import ProfileEditPhoto from '@/modules/users/client/components/ProfileEditPhoto.component';
import { routeOptions, renderWithUser } from '../route-options';

export const Route = createRoute(
  routeOptions('/profile/edit/photo', renderWithUser(ProfileEditPhoto)),
);
