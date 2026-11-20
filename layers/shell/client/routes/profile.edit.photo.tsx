import { createFileRoute } from '@tanstack/react-router';
import ProfileEditPhoto from '@/modules/users/client/components/ProfileEditPhoto.component';
import { routeOptions, renderWithUser } from '../route-options';

export const Route = createFileRoute('/profile/edit/photo')(
  routeOptions('/profile/edit/photo', renderWithUser(ProfileEditPhoto)),
);
