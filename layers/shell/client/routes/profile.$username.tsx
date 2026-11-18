import { createFileRoute } from '@tanstack/react-router';
import ProfilePage from '@/modules/users/client/components/ProfilePage.component';
import { routeOptions, withUser } from '../route-options';

export const Route = createFileRoute('/profile/$username')(
  routeOptions('/profile/:username', withUser(ProfilePage)),
);
