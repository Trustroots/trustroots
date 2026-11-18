import { createFileRoute } from '@tanstack/react-router';
import ProfileEditNetworks from '@/modules/users/client/components/ProfileEditNetworks.component';
import { routeOptions, withUser } from '../route-options';

export const Route = createFileRoute('/profile/edit/networks')(
  routeOptions('/profile/edit/networks', withUser(ProfileEditNetworks)),
);
