import { createFileRoute } from '@tanstack/react-router';
import ProfileEditAbout from '@/modules/users/client/components/ProfileEditAbout.component';
import { routeOptions, withUser } from '../route-options';

export const Route = createFileRoute('/profile/edit/')(
  routeOptions('/profile/edit', withUser(ProfileEditAbout)),
);
