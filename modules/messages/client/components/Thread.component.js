import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import moment from 'moment';

import ReportMemberLink from '@/modules/support/client/components/ReportMemberLink.component';
import * as messagesAPI from '@/modules/messages/client/api/messages.api';
import * as usersAPI from '@/modules/users/client/api/users.api';
import { userType } from '@/modules/users/client/users.prop-types';
import { Monkeybox } from '@/modules/messages/client/components/Monkeybox';
import { getRouteParams } from '@/modules/core/client/services/angular-compat';
import ThreadReply from '@/modules/messages/client/components/ThreadReply';
import { ThreadMessage } from 'modules/messages/client/components/ThreadMessage';

const api = {
  messages: messagesAPI,
  users: usersAPI,
};

function QuickReply() {
  return (
    <div className="btn-toolbar" id="message-quick-reply">
      <button className="btn btn-sm btn-offer-hosting-yes">
        Yes, I can host!
      </button>
      <button className="btn btn-sm btn-offer-hosting-no">
        Sorry, I can&apos;t host
      </button>
      <button className="btn btn-sm btn-offer-meet">
        Write back
      </button>
    </div>
  );
}

// @TODO: this does not replicate the complicated stuff in thread-dimensions, I think we can simplify though ...
const MessagesContainer = styled.div`
  position: fixed;
  top: 44px;
  bottom: 120px;
  width: 800px;
  overflow-y: scroll;
`;

export default function Thread({ user }) {
  const [isFetching, setIsFetching] = useState(false);
  const [otherUser, setOtherUser] = useState(null);
  const [messages, setMessages] = useState([]);

  const showQuickReply = false;

  useEffect(() => {
    async function fetchData() {
      const username = getRouteParams().username;
      try {
        setIsFetching(true);
        const otherUser = await api.users.fetch(username);
        const messages = await api.messages.fetchMessages(otherUser._id);
        setOtherUser(otherUser);
        setMessages(messages.sort((a, b) => a.created.localeCompare(b.created)));
      } finally {
        setIsFetching(false);
      }
    }
    fetchData();
  }, []);

  if (isFetching || !otherUser) {
    return <div>some kind of loading thing...</div>;
  }

  return <section className="container container-spacer">
    <div className="row">
      <div className="col-sm-9">
        <MessagesContainer>
          {messages.length > 0 && <div className="col-xs-12 divider divider-first text-muted">
            <small>Conversation started {moment(messages[0].created).format('LL')}</small>
          </div>}
          {messages.map(message => (
            <ThreadMessage
              key={message._id}
              message={message}
              user={user}
            />
          ))}
        </MessagesContainer>
        {showQuickReply && <QuickReply/>}
        <ThreadReply/>
      </div>
      <div className="col-sm-3 hidden-xs text-center">
        <Monkeybox user={user} otherUser={otherUser}/>
        <ReportMemberLink username={otherUser.username}/>
      </div>
    </div>
  </section>;
}

Thread.propTypes = {
  user: userType.isRequired,
};
