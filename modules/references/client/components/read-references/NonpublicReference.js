import React from 'react';
import PropTypes from 'prop-types';
import Avatar from '@/modules/users/client/components/Avatar.component';
import UserLink from '@/modules/users/client/components/UserLink';

export default function NonpublicReference({ reference }) {
  const daysLeft = 14 - Math.round((Date.now() - new Date(reference.created).getTime()) / 3600 / 24 / 1000);
  return (
    <div>
      <Avatar user={reference.userFrom} size={32} />
      <UserLink user={reference.userFrom} />
      pending
      {daysLeft} days left
      <a href={`/profile/${reference.userFrom.username}/references/new`}>Give a reference</a>
    </div>
  );
}

NonpublicReference.propTypes = {
  reference: PropTypes.object.isRequired
};
