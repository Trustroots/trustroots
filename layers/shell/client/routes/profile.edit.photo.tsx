import { createFileRoute } from '@tanstack/react-router';
import ProfileEditPhoto from '@/modules/users/client/components/ProfileEditPhoto.component';
import { requireAuth, withUser } from '../route-options';

export const Route = createFileRoute('/profile/edit/photo')({
  staticData: { title: 'Edit profile photo' },
  beforeLoad: requireAuth,
  component: withUser(ProfileEditPhoto),
});
