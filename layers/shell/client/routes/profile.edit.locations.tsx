import { createFileRoute } from '@tanstack/react-router';
import ProfileEditLocations from '@/modules/users/client/components/ProfileEditLocations.component';
import { requireAuth, withUser } from '../route-options';

export const Route = createFileRoute('/profile/edit/locations')({
  staticData: { title: 'Edit your locations' },
  beforeLoad: requireAuth,
  component: withUser(ProfileEditLocations),
});
