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
});
