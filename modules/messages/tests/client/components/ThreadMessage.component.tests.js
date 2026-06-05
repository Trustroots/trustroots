import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

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

    expect(screen.getByText('You')).toBeInTheDocument();
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
});
