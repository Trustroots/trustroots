import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import ContactPresentational from '@/modules/contacts/client/components/ContactPresentational';

function makeContact(overrides = {}) {
  return {
    _id: 'contact-1',
    confirmed: true,
    created: '2020-01-01T00:00:00.000Z',
    user: {
      username: 'alice',
      displayName: 'Alice Example',
      locationFrom: 'Lisbon',
      locationLiving: 'Helsinki',
    },
    ...overrides,
  };
}

describe('<ContactPresentational />', () => {
  it('renders contact name and locations', () => {
    render(
      <ContactPresentational
        contact={makeContact()}
        situation="confirmed"
        onClickRemove={() => {}}
      />,
    );

    expect(screen.getByRole('link', { name: 'Alice Example' })).toHaveAttribute(
      'href',
      '/profile/alice',
    );
    expect(screen.getByRole('link', { name: 'Helsinki' })).toHaveAttribute(
      'href',
      '/search?location=Helsinki',
    );
    expect(screen.getByRole('link', { name: 'Lisbon' })).toHaveAttribute(
      'href',
      '/search?location=Lisbon',
    );
  });

  it('shows a revoke action for a request the user sent', () => {
    const onClickRemove = jest.fn();
    render(
      <ContactPresentational
        contact={makeContact({ confirmed: false })}
        situation="unconfirmedFromMe"
        onClickRemove={onClickRemove}
      />,
    );

    expect(
      screen.getByText('Contact request sent and pending.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Revoke Request')).toBeInTheDocument();
  });

  it('shows confirm and decline actions for a request the user received', () => {
    render(
      <ContactPresentational
        contact={makeContact({ confirmed: false })}
        situation="unconfirmedToMe"
        onClickRemove={() => {}}
      />,
    );

    expect(
      screen.getByText('You received a contact request.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Confirm Request' }),
    ).toHaveAttribute('href', '/contact-confirm/contact-1');
    expect(screen.getByText('Decline Request')).toBeInTheDocument();
  });
});
