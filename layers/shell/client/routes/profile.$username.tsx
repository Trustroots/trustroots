import { createFileRoute } from '@tanstack/react-router';
import { profileQuery } from '@/modules/users/client/api/profile-queries';
import ProfilePage from '@/modules/users/client/components/ProfilePage.component';
import { getBootstrapData } from '../bootstrap';
import { routeOptions, withUser } from '../route-options';

export const Route = createFileRoute('/profile/$username')({
  ...routeOptions('/profile/:username', withUser(ProfilePage)),
  loader: ({ context, location, params }) =>
    context.queryClient.prefetchQuery(
      profileQuery((params as { username: string }).username, {
        canLoadReply: Boolean(getBootstrapData().settings.referencesEnabled),
        isCreatingExperience: location.pathname.endsWith('/experiences/new'),
        viewerId: context.user?._id,
      }),
    ),
  // Switching profile tabs keeps the loaded profile.
  staleTime: Infinity,
});
