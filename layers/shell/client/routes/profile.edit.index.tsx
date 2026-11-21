import { createFileRoute } from '@tanstack/react-router';
import ProfileEditAbout from '@/modules/users/client/components/ProfileEditAbout.component';
import { requireAuth, withUser } from '../route-options';

export const Route = createFileRoute('/profile/edit/')({
  staticData: { title: 'Edit profile' },
  beforeLoad: requireAuth,
  component: withUser(ProfileEditAbout),
});
