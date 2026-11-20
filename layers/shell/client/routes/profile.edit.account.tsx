import { createFileRoute } from '@tanstack/react-router';
import ProfileEditAccount from '@/modules/users/client/components/ProfileEditAccount.component';
import { routeOptions, renderWithUser } from '../route-options';

export const Route = createFileRoute('/profile/edit/account')(
  routeOptions('/profile/edit/account', renderWithUser(ProfileEditAccount)),
);
