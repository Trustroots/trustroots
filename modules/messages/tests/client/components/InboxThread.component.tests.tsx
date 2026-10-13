import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import InboxThread from '@/modules/messages/client/components/InboxThread';
import type {
  MessageThreadSummary,
  MessageUser,
} from '@/modules/messages/client/api/messages.api';

jest.mock('@/modules/core/client/components/TimeAgo', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  return function MockTimeAgo() {
    return <time>recently</time>;
  };
});

type MessageUserFixture = MessageUser & { avatarSource: string };

const me: MessageUserFixture = {
  _id: 'me',
  username: 'me',
  displayName: 'Me',
  avatarSource: 'none',
};

const otherUser: MessageUserFixture = {
  _id: 'other',
  username: 'other',
  displayName: 'Other Member',
  avatarSource: 'none',
};

type ThreadOverrides = Partial<
  Omit<MessageThreadSummary, 'userFrom' | 'userTo' | 'message'>
> & {
  userFrom?: MessageUser;
  userTo?: MessageUser;
  message?: MessageThreadSummary['message'];
};

function thread(overrides: ThreadOverrides = {}): MessageThreadSummary {
  return {
    _id: 'thread-1',
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
  it('renders a placeholder when the other participant is absent', () => {
    render(<InboxThread user={me} thread={{ ...thread(), userFrom: null }} />);

    expect(screen.getByText('Unknown member')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/messages/undefined?userId=',
    );
  });

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
    expect(
      container.querySelector('.threadlist-thread-excerpt'),
    ).toHaveTextContent('<strong>Hello</strong>');
    expect(screen.getByText('recently')).toBeInTheDocument();
    expect(container.querySelector('.icon-reply')).not.toBeInTheDocument();
  });

  it('renders markup characters in previews as literal text', () => {
    const excerpt = '<img src=x onerror=alert(1)><a href="/signin">Hello</a>';
    const { container } = render(
      <InboxThread user={me} thread={thread({ message: { excerpt } })} />,
    );
    const preview = container.querySelector('.threadlist-thread-excerpt');
    expect(preview).toHaveTextContent(excerpt);
    expect(preview?.querySelector('img, a')).toBeNull();
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
