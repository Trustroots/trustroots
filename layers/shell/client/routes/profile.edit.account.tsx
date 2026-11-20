import { createFileRoute } from '@tanstack/react-router';
import ProfileEditAccount from '@/modules/users/client/components/ProfileEditAccount.component';
import { routeOptions, withUser } from '../route-options';

export const Route = createFileRoute('/profile/edit/account')(
  routeOptions(
    { title: 'Account', requiresAuth: true },
    withUser(ProfileEditAccount),
  ),
);
