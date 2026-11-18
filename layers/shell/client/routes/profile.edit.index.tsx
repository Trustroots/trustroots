import { createFileRoute } from '@tanstack/react-router';
import ProfileEditAbout from '@/modules/users/client/components/ProfileEditAbout.component';
import { routeOptions, renderWithUser } from '../route-options';

export const Route = createFileRoute('/profile/edit/')(
  routeOptions('/profile/edit', renderWithUser(ProfileEditAbout)),
);
