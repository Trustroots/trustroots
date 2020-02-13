import React, { useEffect, useState } from 'react';
import keyBy from 'lodash/keyBy';

import Avatar from '@/modules/users/client/components/Avatar.component';
import { userType } from '@/modules/users/client/users.prop-types';

function TribesInCommon({ user, otherUser }) {
  const [tribesInCommon, setTribesInCommon] = useState([]);

  useEffect(() => {
    // otherUser will have a filled out tribe details, my user won't...
    const byId = keyBy(
      otherUser.member.map(membership => membership.tribe),
      tribe => tribe._id,
    );
    const tribesInCommon = user.memberIds
      .filter(id => byId[id])
      .map(id => byId[id]);
    setTribesInCommon(tribesInCommon);
  }, [user, otherUser]);

  if (tribesInCommon.length === 0) return null;

  return (
    <div className="monkeybox-section">
      <div className="tribes-common">
        <h4>Tribes in common</h4>
        <ul className="list-inline">
          {tribesInCommon.map(tribe => (
            <li key={tribe._id}>
              <a className="tribe-link" href={`/tribes/${tribe.slug}`}>
                {tribe.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

TribesInCommon.propTypes = {
  user: userType.isRequired,
  otherUser: userType.isRequired,
};

export default function Monkeybox({ user, otherUser }) {
  return (
    <div className="monkeybox panel panel-default">
      <div className="panel-body">
        <Avatar user={user} size={64} />
        <h3>
          <a>{user.displayName}</a>
        </h3>
        <TribesInCommon user={user} otherUser={otherUser} />
        {user.languages.length > 0 && (
          <div className="monkeybox-section">
            <h4>Languages</h4>
            <ul className="list-unstyled">
              {user.languages.map(language => (
                <li key={language.code}>{language.code}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

Monkeybox.propTypes = {
  user: userType.isRequired,
  otherUser: userType.isRequired,
};
