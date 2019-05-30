import React from 'react';
import PropTypes from 'prop-types';
import PublicReference from './PublicReference';
import NonpublicReference from './NonpublicReference';
import Avatar from '@/modules/users/client/components/Avatar.component';
import UserLink from '@/modules/users/client/components/UserLink';

export default function Reference({ reference }) {
  const body = (reference.public) ? <PublicReference reference={reference} /> : <NonpublicReference reference={reference} />;

  return (
    <div className="panel panel-default">
      <div className="panel-body reference">
        <Avatar user={reference.userFrom} size={64} />
        <h4><UserLink user={reference.userFrom} /></h4>
        {body}
      </div>
    </div>
  );
}

Reference.propTypes = {
  reference: PropTypes.object.isRequired
};
