import { createFileRoute } from '@tanstack/react-router';
import MemberProfile, { memberProfileQuery } from '../member-profile';
import { getBootstrapData } from '../bootstrap';
import { requireAuth, withUser } from '../route-options';

export const Route = createFileRoute('/profile/$username')({
  staticData: { title: 'Profile', noScrollingTop: true },
  beforeLoad: requireAuth,
  component: withUser(MemberProfile),
  // Fetch early without blocking navigation; the page shows its own loading.
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(
      memberProfileQuery((params as { username: string }).username, {
        canLoadReply: Boolean(getBootstrapData().settings.referencesEnabled),
        viewerId: context.user?._id,
      }),
    );
  },
});
