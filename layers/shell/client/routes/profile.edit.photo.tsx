import { createFileRoute } from '@tanstack/react-router';
import ProfileEditPhoto from '@/modules/users/client/components/ProfileEditPhoto.component';
import { routeOptions, withUser } from '../route-options';

export const Route = createFileRoute('/profile/edit/photo')(
  routeOptions('/profile/edit/photo', withUser(ProfileEditPhoto)),
);
