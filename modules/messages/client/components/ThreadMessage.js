import React from 'react';
import { useMediaQuery } from 'react-responsive';
import PropTypes from 'prop-types';

import Avatar from '@/modules/users/client/components/Avatar.component';
import TimeAgo from '@/modules/core/client/components/TimeAgo';
import { userType } from '@/modules/users/client/users.prop-types';

function isHosting(content) {
  if (content.substr(0, 21) === '<p data-hosting="yes"') {
    return true;
  } else if (content.substr(0, 20) === '<p data-hosting="no"') {
    return false;
  } else {
    return null;
  }
}

function getHostingData(content) {
  const hosting = isHosting(content);
  if (hosting === null) return {};
  return {
    'data-hosting': hosting ? 'yes' : 'no',
  };
}

export default function ThreadMessage({ message, user }) {
  const hostingData = getHostingData(message.content);

  function isMe(otherUser) {
    return otherUser._id === user._id;
  }

  const isExtraSmall = useMediaQuery({ maxWidth: 768 - 1 });

  return (
    <div
      className="message"
      style={{ display: 'flex' }}
      {...hostingData}
    >
      <div style={{ flexGrow: '1' }}>
        <div className="message-meta">
          {isMe(message.userFrom) ? (
            <span>You</span>
          ) : (
            <a href={`/profile/${message.userFrom.username}`}>
              {message.userFrom.displayName}
            </a>
          )}
          —
          <TimeAgo date={new Date(message.created)}/>
        </div>
        <div className="panel panel-default" style={{ display: 'flex' }}>
          {isExtraSmall ? (
            <>
              <div style={{ padding: '8px' }}><Avatar user={message.userFrom} size={24} /></div>
              <div
                className="panel-body"
                style={{ padding: '8px 15px 8px 4px' }}
                dangerouslySetInnerHTML={{ __html: message.content }}
              />
            </>
          ) : (
            <div
              className="panel-body"
              dangerouslySetInnerHTML={{ __html: message.content }}
            />
          )}
        </div>
      </div>
      {!isExtraSmall && <div className="message-author" style={{ marginLeft: '15px', marginRight: '15px' }}>
        <Avatar user={message.userFrom} size={32}/>
      </div>}
    </div>
  );
}

ThreadMessage.propTypes = {
  message: PropTypes.shape({
    userFrom: userType.isRequired,
    created: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
  }),
  user: userType.isRequired,
};
