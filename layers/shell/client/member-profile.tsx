import React from 'react';
import { profileExperiences } from '@/modules/experiences/client/profile-experiences';
import Offers from '@/modules/offers/client/components/Offers.component';
import { memberCircles } from '@/modules/tribes/client/member-circles';
import { profileQuery } from '@/modules/users/client/api/profile-queries';
import ProfilePage, {
  type ProfilePageProps,
} from '@/modules/users/client/components/ProfilePage.component';

export function memberProfileQuery(
  username: string,
  options: Parameters<typeof profileQuery>[1],
) {
  return profileQuery(username, options, profileExperiences.readReplyRecipient);
}

export default function MemberProfile(props: ProfilePageProps) {
  return (
    <ProfilePage
      {...props}
      ProfileOffers={Offers}
      circles={memberCircles}
      experiences={profileExperiences}
    />
  );
}
