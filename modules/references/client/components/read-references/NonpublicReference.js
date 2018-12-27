import React from 'react';
import PropTypes from 'prop-types';

export default function NonpublicReference({ reference }) {
  const daysLeft = 14 - Math.round((Date.now() - new Date(reference.created).getTime()) / 3600 / 24 / 1000);
  return (
    <div>
      <div><small>pending</small></div>
      <div>{daysLeft} days left</div>
      <div>
        <a
          className="btn btn-xs btn-primary"
          href={`/profile/${reference.userFrom.username}/references/new`}
        >Give a reference</a>
      </div>
    </div>
  );
}

NonpublicReference.propTypes = {
  reference: PropTypes.object.isRequired
};
