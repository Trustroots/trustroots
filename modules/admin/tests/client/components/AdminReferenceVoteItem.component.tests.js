import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import AdminReferenceVoteItem from '@/modules/admin/client/components/AdminReferenceVoteItem.component';

describe('<AdminReferenceVoteItem />', () => {
  it('shows badge messages for positive votes with raw user ids', () => {
    render(
      <ul>
        <AdminReferenceVoteItem
          referenceThread={{
            reference: 'yes',
            userFrom: 'member-1',
            userTo: 'member-2',
          }}
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
    render(
      <ul>
        <AdminReferenceVoteItem referenceThread={{}} />
      </ul>,
    );

    expect(screen.getByText('negative')).toBeInTheDocument();
    expect(screen.getAllByText('Unknown')).toHaveLength(2);
  });
});
