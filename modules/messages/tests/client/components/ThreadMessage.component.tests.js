import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import ThreadMessage from '@/modules/messages/client/components/ThreadMessage';

describe('<ThreadMessage />', function () {
  const me = {
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
          content: '<p>Hello</p>',
          userFrom: me,
        }}
      />,
    );

    expect(screen.getByText('You').closest('.message')).toHaveClass(
      'message-sender-me',
    );
  });

  it('links other users by username', () => {
    const other = {
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
          content: '<p>Welcome</p>',
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
          content:
            '<p>Here is my scam link <a href="https://scammetyscammetyscam.example.com/">scammetyscammetyscam.example.com</a> ' +
            '<a href="//scammetyscammetyscam.example.com/">another one</a> ' +
            '<a href="mailto:member@example.org">email</a> ' +
            '<a href="javascript:alert(1)">unsafe scheme</a> ' +
            '<a href="http://[">invalid address</a> ' +
            '<a>missing address</a> ' +
            '<a href="/safety">safety guidance</a></p>',
          userFrom: me,
        }}
      />,
    );

    const body = container.querySelector('.panel-body');
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
          content: '<p>Deleted</p>',
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
          content: '<p data-hosting="yes">Happy to host</p>',
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
          content: '<p data-hosting="no">Not hosting this time</p>',
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
