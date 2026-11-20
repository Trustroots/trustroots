import { createFileRoute } from '@tanstack/react-router';
import { profileQuery } from '@/modules/users/client/api/profile-queries';
import ProfilePage from '@/modules/users/client/components/ProfilePage.component';
import { getBootstrapData } from '../bootstrap';
import { routeOptions, withUser } from '../route-options';

export const Route = createFileRoute('/profile/$username')({
  ...routeOptions(
    { title: 'Profile', requiresAuth: true, noScrollingTop: true },
    withUser(ProfilePage),
  ),
  // Fetch early without blocking navigation; the page shows its own loading.
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(
      profileQuery((params as { username: string }).username, {
        canLoadReply: Boolean(getBootstrapData().settings.referencesEnabled),
        viewerId: context.user?._id,
      }),
    );
  },
});
