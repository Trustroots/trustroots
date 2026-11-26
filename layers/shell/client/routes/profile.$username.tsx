import { createFileRoute } from '@tanstack/react-router';
import React from 'react';
import Offers from '@/modules/offers/client/components/Offers.component';
import { profileQuery } from '@/modules/users/client/api/profile-queries';
import ProfilePage from '@/modules/users/client/components/ProfilePage.component';
import { memberCircles } from '@/modules/tribes/client/member-circles';
import { getBootstrapData } from '../bootstrap';
import { requireAuth, withUser } from '../route-options';

function ComposedProfile({
  user,
}: Pick<React.ComponentProps<typeof ProfilePage>, 'user'>) {
  return (
    <ProfilePage user={user} ProfileOffers={Offers} circles={memberCircles} />
  );
}

export const Route = createFileRoute('/profile/$username')({
  staticData: { title: 'Profile', noScrollingTop: true },
  beforeLoad: requireAuth,
  component: withUser(ComposedProfile),
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
