import PropTypes from 'prop-types';
import React from 'react';

import OfferActivateProfile from './OfferActivateProfile.component';

export default function OfferShell({ children, user }) {
  return (
    <section className="container container-spacer offer">
      {!user?.public && <OfferActivateProfile />}
      {user?.public && children}
    </section>
  );
}

OfferShell.propTypes = {
  children: PropTypes.node,
  user: PropTypes.object,
};
