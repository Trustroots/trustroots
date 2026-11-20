import { createFileRoute } from '@tanstack/react-router';
import ProfileEditNetworks from '@/modules/users/client/components/ProfileEditNetworks.component';
import { requireAuth, withUser } from '../route-options';

export const Route = createFileRoute('/profile/edit/networks')({
  staticData: { title: 'Edit Profile networks' },
  beforeLoad: requireAuth,
  component: withUser(ProfileEditNetworks),
});
