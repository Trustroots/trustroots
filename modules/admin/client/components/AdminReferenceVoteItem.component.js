// External dependencies
import PropTypes from 'prop-types';
import React from 'react';

// Internal dependencies
import UserLink from './UserLink.component';
import { getReferenceUserId } from './userSearch.helpers';

function getReferenceLabel(reference) {
  if (reference === 'yes') {
    return {
      labelClassName: 'label label-success',
      text: 'positive',
      textClassName: 'text-success',
    };
  }

  return {
    labelClassName: 'label label-danger',
    text: 'negative',
    textClassName: 'text-danger',
  };
}

export default function AdminReferenceVoteItem({
  referenceThread,
  showBadge,
  showMessagesLink,
}) {
  const { labelClassName, text, textClassName } = getReferenceLabel(
    referenceThread.reference,
  );
  const userFromId = getReferenceUserId(referenceThread, 'userFrom');
  const userToId = getReferenceUserId(referenceThread, 'userTo');

  if (showBadge) {
    return (
      <li>
        <span className={labelClassName}>{text}</span>{' '}
        <UserLink user={referenceThread.userFrom} />
        {' voted for '}
        <UserLink user={referenceThread.userTo} />
        {showMessagesLink && (
          <>
            {' · '}
            <a
              href={`/admin/messages?userId1=${userFromId}&userId2=${userToId}`}
            >
              Read messages
            </a>
          </>
        )}
      </li>
    );
  }

  return (
    <li>
      <UserLink user={referenceThread.userFrom} />
      {' voted '}
      <span className={textClassName}>{text}</span>
      {' for '}
      <UserLink user={referenceThread.userTo} />
    </li>
  );
}

AdminReferenceVoteItem.propTypes = {
  referenceThread: PropTypes.object.isRequired,
  showBadge: PropTypes.bool,
  showMessagesLink: PropTypes.bool,
};

AdminReferenceVoteItem.defaultProps = {
  showBadge: false,
  showMessagesLink: false,
};
