import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import AdminReferenceVoteItem from '@/modules/admin/client/components/AdminReferenceVoteItem.component';

describe('<AdminReferenceVoteItem />', () => {
  it('shows badge messages for positive votes with raw user ids', () => {
    const referenceThread: React.ComponentProps<
      typeof AdminReferenceVoteItem
    >['referenceThread'] = {
      reference: 'yes',
      userFrom: 'member-1',
      userTo: 'member-2',
    };

    render(
      <ul>
        <AdminReferenceVoteItem
          referenceThread={referenceThread}
          showBadge
          showMessagesLink
        />
      </ul>,
    );

    expect(screen.getByText('positive')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Read messages' })).toHaveAttribute(
      'href',
      '/admin/messages?userId1=member-1&userId2=member-2',
    );
    expect(screen.getAllByText('Unknown')).toHaveLength(2);
  });

  it('renders a negative vote without a badge or member identities', () => {
    const referenceThread: React.ComponentProps<
      typeof AdminReferenceVoteItem
    >['referenceThread'] = {};

    render(
      <ul>
        <AdminReferenceVoteItem referenceThread={referenceThread} />
      </ul>,
    );

    expect(screen.getByText('negative')).toBeInTheDocument();
    expect(screen.getAllByText('Unknown')).toHaveLength(2);
  });

  it('opens message history by username when both identities are available', () => {
    render(
      <ul>
        <AdminReferenceVoteItem
          referenceThread={{
            reference: 'yes',
            userFrom: { _id: 'member-1', username: 'alice' },
            userTo: { _id: 'member-2', username: 'bob' },
          }}
          showBadge
          showMessagesLink
        />
      </ul>,
    );

    expect(screen.getByRole('link', { name: 'Read messages' })).toHaveAttribute(
      'href',
      '/admin/messages?username1=alice&username2=bob',
    );
  });

  it('omits a message link when a deleted member has no identifier', () => {
    render(
      <ul>
        <AdminReferenceVoteItem
          referenceThread={{
            reference: 'yes',
            userFrom: { _id: 'member-1', username: 'alice' },
          }}
          showBadge
          showMessagesLink
        />
      </ul>,
    );

    expect(
      screen.queryByRole('link', { name: 'Read messages' }),
    ).not.toBeInTheDocument();
  });
});
