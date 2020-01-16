import React from 'react';
import styled from 'styled-components';
import { useMediaQuery } from 'react-responsive';
import PropTypes from 'prop-types';

import Avatar from '@/modules/users/client/components/Avatar.component';
import TimeAgo from '@/modules/core/client/components/TimeAgo';
import { userType } from '@/modules/users/client/users.prop-types';

const FloatAvatar = styled.div`
  float: left;
  margin: 5px 0 0 5px;
`;

export function ThreadMessage({ message, user }) {

  function isMe(otherUser) {
    return otherUser._id === user._id;
  }

  const isExtraSmall = useMediaQuery({ maxWidth: 768 - 1 });

  let avatar = null;

  if (isExtraSmall) {
    avatar = (
      <FloatAvatar>
        <Avatar user={message.userFrom} size={24} inline={false}/>
      </FloatAvatar>
    );
  }

  return <div className="message">
    <div className="col-xs-12 col-sm-11">
      <div className="message-meta">
        {isMe(message.userFrom) ? <span>You</span> : <a>{message.userFrom.displayName}</a>}
        —
        <TimeAgo date={new Date(message.created)}/>
      </div>
      <div className="message-content panel panel-default">
        {avatar}
        <div
          className="panel-body"
          dangerouslySetInnerHTML={{ __html: message.content }}
        />
      </div>
    </div>
    {!isExtraSmall && <div className="col-sm-1 message-author">
      <Avatar user={message.userFrom} size={32}/>
    </div>}
  </div>;
}

ThreadMessage.propTypes = {
  message: PropTypes.shape({
    userFrom: userType.isRequired,
    created: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
  }),
  user: userType.isRequired,
};
