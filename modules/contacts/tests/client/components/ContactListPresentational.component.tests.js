import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import ContactListPresentational from '@/modules/contacts/client/components/ContactListPresentational';

jest.mock('@/modules/contacts/client/components/Contact', () => {
  const React = require('react');
  function MockContact({ contact }) {
    return <div>{`contact-${contact.user.username}`}</div>;
  }
  MockContact.propTypes = { contact: () => null };
  return MockContact;
});

function contact(username, confirmed = true) {
  return {
    _id: `id-${username}`,
    confirmed,
    user: { username, displayName: username },
  };
}

describe('<ContactListPresentational />', () => {
  it('shows confirmed counts and pending counts', () => {
    render(
      <ContactListPresentational
        selfId="me"
        filter=""
        contacts={[contact('alice'), contact('bob', false)]}
        onContactRemoved={() => {}}
        onFilterChange={() => {}}
      />,
    );

    expect(screen.getByText('1 contacts')).toBeInTheDocument();
    expect(screen.getByText('(additional 1 pending)')).toBeInTheDocument();
    expect(screen.getByText('contact-alice')).toBeInTheDocument();
    expect(screen.getByText('contact-bob')).toBeInTheDocument();
  });

  it('shows a search field and calls onFilterChange when there are 6+ contacts', () => {
    const onFilterChange = jest.fn();
    const contacts = ['a', 'b', 'c', 'd', 'e', 'f'].map(name => contact(name));

    render(
      <ContactListPresentational
        selfId="me"
        filter=""
        contacts={contacts}
        onContactRemoved={() => {}}
        onFilterChange={onFilterChange}
      />,
    );

    const input = screen.getByPlaceholderText('Search contacts');
    fireEvent.change(input, { target: { value: 'a' } });
    expect(onFilterChange).toHaveBeenCalledWith('a');
  });

  it('filters contacts by the provided filter string', () => {
    render(
      <ContactListPresentational
        selfId="me"
        filter="alice"
        contacts={[contact('alice'), contact('bob')]}
        onContactRemoved={() => {}}
        onFilterChange={() => {}}
      />,
    );

    expect(screen.getByText('contact-alice')).toBeInTheDocument();
    expect(screen.queryByText('contact-bob')).not.toBeInTheDocument();
  });
});
