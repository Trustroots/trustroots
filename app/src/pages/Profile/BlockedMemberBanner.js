/**
 * Banner that describes that user is blocked
 */

import PropTypes from 'prop-types';
import React from 'react';

/* import BlockMember from './BlockMember';
import ReportMember from '@/modules/support/client/components/ReportMember.component.js'; */

export default function BlockedMemberBanner({ username }) {

  return (
    <div className="alert alert-warning" role="alert">
      <p>
        You have blocked this member. They cannot see or message you.
        {/* <ReportMember username={username} className="btn btn-link" />
        <BlockMember isBlocked username={username} className="btn btn-link" /> */}
      </p>
    </div>
  );
}

BlockedMemberBanner.propTypes = {
  username: PropTypes.string.isRequired,
};
