import React from 'react';
import PropTypes from 'prop-types';

import { useAuth } from '@/modules/core/client/react-app/auth';
import TribesPage from './TribesPage.component';
import TribeDetailPage from './TribeDetailPage.component';

export default function CirclesRoute({ circle, user }) {
  const { setUser } = useAuth();

  function handleMembershipUpdated(data) {
    if (data?.user) {
      // Membership responses contain profile fields, while roles come from
      // the authenticated page bootstrap.
      const updatedUser = { ...user, ...data.user, roles: user.roles };
      setUser(updatedUser);
      window.user = updatedUser;
    }
  }

  return circle ? (
    <TribeDetailPage
      key={circle}
      circle={circle}
      user={user}
      onMembershipUpdated={handleMembershipUpdated}
    />
  ) : (
    <TribesPage user={user} onMembershipUpdated={handleMembershipUpdated} />
  );
}

CirclesRoute.propTypes = {
  circle: PropTypes.string,
  user: PropTypes.object,
};
