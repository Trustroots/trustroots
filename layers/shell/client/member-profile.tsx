import React from 'react';
import { profileContacts } from '@/modules/contacts/client/profile-contacts';
import { createProfileExperiences } from '@/modules/experiences/client/profile-experiences';
import Offers from '@/modules/offers/client/components/Offers.component';
import { reportMember } from '@/modules/support/client/api/support.api';
import { memberCircles } from '@/modules/tribes/client/member-circles';
import { profileQuery } from '@/modules/users/client/api/profile-queries';
import ProfilePage, {
  type ProfilePageProps,
} from '@/modules/users/client/components/ProfilePage.component';

const profileExperiences = createProfileExperiences(reportMember);

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
      contactFeatures={profileContacts}
      experiences={profileExperiences}
    />
  );
}
