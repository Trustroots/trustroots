import { createFileRoute } from '@tanstack/react-router';
import ProfileEditAccount from '@/modules/users/client/components/ProfileEditAccount.component';
import { requireAuth, withUser } from '../route-options';

export const Route = createFileRoute('/profile/edit/account')({
  staticData: { title: 'Account' },
  beforeLoad: requireAuth,
  component: withUser(ProfileEditAccount),
});
