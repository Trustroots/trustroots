import { createFileRoute } from '@tanstack/react-router';
import ProfileEditLocations from '@/modules/users/client/components/ProfileEditLocations.component';
import { routeOptions, withUser } from '../route-options';

export const Route = createFileRoute('/profile/edit/locations')(
  routeOptions('/profile/edit/locations', withUser(ProfileEditLocations)),
);
