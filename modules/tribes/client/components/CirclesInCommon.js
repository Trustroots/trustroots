// External dependencies
import keyBy from 'lodash/keyBy';
import React, { useEffect, useState } from 'react';

// Internal dependencies
import { userType } from '@/modules/users/client/users.prop-types';

export default function CirclesInCommon({ user, otherUser }) {
  const [circles, setCircles] = useState([]);

  useEffect(() => {
    // user will have a filled out circle details, otherUser won't...
    const byId = keyBy(
      user?.member?.map(({ tribe }) => tribe),
      tribe => tribe._id,
    );
    const circlesInCommon = otherUser?.memberIds
      ?.filter(id => byId[id])
      .map(id => byId[id]);
    setCircles(circlesInCommon);
  }, [user, otherUser]);

  if (!circles?.length) {
    return null;
  }

  return (
    <ul className="list-inline">
      {circles.map(({ _id, label, slug }) => (
        <li key={_id}>
          <a className="tribe-link" href={`/circles/${slug}`}>
            {label}
          </a>
        </li>
      ))}
    </ul>
  );
}

CirclesInCommon.propTypes = {
  user: userType.isRequired,
  otherUser: userType.isRequired,
};
