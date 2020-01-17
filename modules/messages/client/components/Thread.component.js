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
import ThreadMessage from 'modules/messages/client/components/ThreadMessage';

import faker from 'faker';
import range from 'lodash/range';
import { useMediaQuery } from 'react-responsive';
import { Avatar } from 'modules/users/client/components/Avatar.component';

function generateMessage(userFrom) {
  return {
    userFrom,
    // userFrom: {
    //   displayName: faker.name.findName(),
    //   username: faker.internet.userName(),
    // },
    created: new Date().toISOString(),
    content: faker.lorem.text(),
  };
}

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

const ThreadContainer = styled.div`
  position: fixed;
  top: 44px;
  bottom: 0;
  width: 100%;
  @media (min-width: 768px) {
    width: 505px;
    bottom: 12px;
  }
  @media (min-width: 992px) {
    width: 667px;
  }
  @media (min-width: 1200px) {
    width: 800px;
  }
  display: flex;
  flex-direction: column;
`;

const MessagesContainer = styled.div`
  flex-grow: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 15px;
  padding-top: 30px;
`;

export default function Thread({ user }) {
  const [isFetching, setIsFetching] = useState(false);
  const [otherUser, setOtherUser] = useState(null);
  const [messages, setMessages] = useState([]);

  const showQuickReply = false;

  const isExtraSmall = useMediaQuery({ maxWidth: 768 - 1 });

  useEffect(() => {
    async function fetchData() {
      const username = getRouteParams().username;
      try {
        setIsFetching(true);
        const otherUser = await api.users.fetch(username);
        const messages = await api.messages.fetchMessages(otherUser._id);

        // @TODO remove these
        messages.push(...range(10).map(() => generateMessage(otherUser)));

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
        <ThreadContainer>
          <MessagesContainer>
            {isExtraSmall && (
              <div className="message">
                <div className="message-recipient panel panel-default">
                  <a className="panel-body" href={`/profile/${user.username}`}>
                    <Avatar user={otherUser} size={32} link={false} />
                    <h4>
                      { otherUser.displayName }
                    </h4>
                    <small className="text-muted">
                      @{ otherUser.username }
                    </small>
                  </a>
                </div>
              </div>
            )}

            {messages.length > 0 && (
              <div className="message">
                <div className="divider divider-first text-muted">
                  <small>Conversation started {moment(messages[0].created).format('LL')}</small>
                </div>
              </div>
            )}
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
        </ThreadContainer>
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
