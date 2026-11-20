import { createFileRoute } from '@tanstack/react-router';
import ProfileSignupPage from '@/modules/users/client/components/ProfileSignupPage.component';

export const Route = createFileRoute('/profile-signup')({
  staticData: { title: 'Trustroots profile' },
  component: ProfileSignupPage,
});
