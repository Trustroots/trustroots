import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import InboxThread from '@/modules/messages/client/components/InboxThread';

jest.mock('@/modules/core/client/components/TimeAgo', () => {
  const React = require('react');

  return function MockTimeAgo() {
    return <time>recently</time>;
  };
});

const me = {
  _id: 'me',
  username: 'me',
  displayName: 'Me',
  avatarSource: 'none',
};

const otherUser = {
  _id: 'other',
  username: 'other',
  displayName: 'Other Member',
  avatarSource: 'none',
};

function thread(overrides = {}) {
  return {
    read: false,
    updated: '2026-06-05T12:00:00.000Z',
    userFrom: otherUser,
    userTo: me,
    message: {
      excerpt: '<strong>Hello</strong>',
    },
    ...overrides,
  };
}

describe('<InboxThread />', () => {
  it('renders unread state, other member link, avatar, time, and excerpt', () => {
    const { container } = render(<InboxThread user={me} thread={thread()} />);

    expect(container.querySelector('li')).toHaveClass(
      'threadlist-thread-unread',
    );
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/messages/other?userId=other',
    );
    expect(screen.getByText('Other Member')).toBeInTheDocument();
    expect(container.querySelector('.threadlist-thread-excerpt')).toContainHTML(
      '<strong>Hello</strong>',
    );
    expect(screen.getByText('recently')).toBeInTheDocument();
    expect(container.querySelector('.icon-reply')).not.toBeInTheDocument();
  });

  it('renders replied and unknown-member states for read threads', () => {
    const { container } = render(
      <InboxThread
        user={me}
        thread={thread({
          read: true,
          userFrom: me,
          userTo: {
            ...otherUser,
            displayName: '',
          },
        })}
      />,
    );

    expect(container.querySelector('li')).not.toHaveClass(
      'threadlist-thread-unread',
    );
    expect(screen.getByText('Unknown member')).toBeInTheDocument();
    expect(container.querySelector('.icon-reply')).toHaveAttribute(
      'title',
      'You replied',
    );
  });
});
