import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import ThreadMessage from '@/modules/messages/client/components/ThreadMessage';
import type { MessageUser } from '@/modules/messages/client/api/messages.api';

describe('<ThreadMessage />', function () {
  const me: MessageUser = {
    _id: 'user-me',
    displayName: 'Me',
    username: 'me',
  };

  it('shows "You" for own messages', () => {
    render(
      <ThreadMessage
        user={me}
        message={{
          _id: 'msg-1',
          created: '2026-06-05T12:00:00.000Z',
          read: false,
          content: '<p>Hello</p>',
          userTo: me,
          userFrom: me,
        }}
      />,
    );

    expect(screen.getByText('You').closest('.message')).toHaveClass(
      'message-sender-me',
    );
  });

  it('links other users by username', () => {
    const other: MessageUser = {
      _id: 'user-other',
      username: 'travel',
      displayName: 'Traveler',
    };

    render(
      <ThreadMessage
        user={me}
        message={{
          _id: 'msg-2',
          created: '2026-06-05T12:00:00.000Z',
          read: false,
          content: '<p>Welcome</p>',
          userTo: me,
          userFrom: other,
        }}
      />,
    );

    const profileLink = screen.getByRole('link', {
      name: 'Traveler',
    });

    expect(profileLink).toHaveAttribute('href', '/profile/travel');
    expect(profileLink.closest('.message')).toHaveClass('message-sender-other');
  });

  it('shows external message links as text while preserving internal links', () => {
    const { container } = render(
      <ThreadMessage
        user={me}
        message={{
          _id: 'msg-links',
          created: '2026-06-05T12:00:00.000Z',
          read: false,
          content:
            '<p>Here is my scam link <a href="https://scammetyscammetyscam.example.com/">scammetyscammetyscam.example.com</a> ' +
            '<a href="//scammetyscammetyscam.example.com/">another one</a> ' +
            '<a href="mailto:member@example.org">email</a> ' +
            '<a href="javascript:alert(1)">unsafe scheme</a> ' +
            '<a href="http://[">invalid address</a> ' +
            '<a>missing address</a> ' +
            '<a href="/safety">safety guidance</a></p>',
          userTo: me,
          userFrom: me,
        }}
      />,
    );

    const body = container.querySelector('.panel-body');
    if (!body) {
      throw new Error('Expected the message body to render');
    }
    expect(body).toHaveTextContent('scammetyscammetyscam.example.com');
    expect(body).toHaveTextContent('another one');
    expect(body).toHaveTextContent('email');
    expect(body).toHaveTextContent('unsafe scheme');
    expect(body).toHaveTextContent('invalid address');
    expect(body).toHaveTextContent('missing address');
    expect(body.querySelectorAll('a')).toHaveLength(1);
    expect(
      screen.getByRole('link', { name: 'safety guidance' }),
    ).toHaveAttribute('href', '/safety');
  });

  it('shows a placeholder for deleted members', () => {
    render(
      <ThreadMessage
        user={me}
        message={{
          _id: 'msg-3',
          created: '2026-06-05T12:00:00.000Z',
          read: false,
          content: '<p>Deleted</p>',
          userTo: me,
          userFrom: {
            _id: 'deleted-id',
            displayName: 'Deleted',
          },
        }}
      />,
    );

    expect(screen.getByText('Unknown member')).toBeInTheDocument();
  });

  it('preserves the hosting acceptance marker on outgoing bubbles', () => {
    const { container } = render(
      <ThreadMessage
        user={me}
        message={{
          _id: 'msg-hosting',
          created: '2026-06-05T12:00:00.000Z',
          read: false,
          content: '<p data-hosting="yes">Happy to host</p>',
          userTo: me,
          userFrom: me,
        }}
      />,
    );

    expect(container.querySelector('.message-sender-me')).toHaveAttribute(
      'data-hosting',
      'yes',
    );
  });

  it('marks messages that explicitly say hosting was declined', () => {
    const { container } = render(
      <ThreadMessage
        user={me}
        message={{
          _id: 'msg-4',
          created: '2026-06-05T12:00:00.000Z',
          read: false,
          content: '<p data-hosting="no">Not hosting this time</p>',
          userTo: me,
          userFrom: me,
        }}
      />,
    );

    expect(container.querySelector('.message')).toHaveAttribute(
      'data-hosting',
      'no',
    );
  });
});
