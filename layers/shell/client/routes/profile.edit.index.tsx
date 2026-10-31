import { createRoute } from '@tanstack/react-router';
import ProfileEditAbout from '@/modules/users/client/components/ProfileEditAbout.component';
import { routeOptions, renderWithUser } from '../route-options';

export const Route = createRoute(
  routeOptions('/profile/edit', renderWithUser(ProfileEditAbout)),
);
