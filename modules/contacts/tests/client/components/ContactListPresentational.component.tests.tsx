import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import ContactListPresentational from '@/modules/contacts/client/components/ContactListPresentational';
import type Contact from '@/modules/contacts/client/components/Contact';
import type { ContactListEntry } from '@/modules/contacts/client/types';

jest.mock('@/modules/contacts/client/components/Contact', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  function MockContact({
    contact,
    onContactRemoved,
  }: React.ComponentProps<typeof Contact>) {
    return (
      <button type="button" onClick={onContactRemoved}>
        {`contact-${contact.user.username}`}
      </button>
    );
  }
  return MockContact;
});

function contact(username: string, confirmed = true): ContactListEntry {
  return {
    _id: `id-${username}`,
    confirmed,
    created: '2025-01-02T00:00:00.000Z',
    user: { _id: `user-${username}`, username, displayName: username },
  };
}

function contactWithoutCreatedDate(username: string): ContactListEntry {
  // Preserve the malformed legacy fixture that exercises the missing-date sort fallback.
  return { ...contact(username), created: undefined as unknown as string };
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

  it('ignores contacts without matching string user fields', () => {
    render(
      <ContactListPresentational
        selfId="me"
        filter="alice"
        contacts={[
          {
            _id: 'id-numeric',
            confirmed: true,
            created: '2025-01-02T00:00:00.000Z',
            user: {
              _id: 'user-numeric',
              username: 'numeric-member',
              displayName: 'Numeric Member',
              id: 12345,
            },
          },
        ]}
        onContactRemoved={() => {}}
        onFilterChange={() => {}}
      />,
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('orders by newest date, then switches to names without mutating contacts', () => {
    const contacts = [
      contactWithoutCreatedDate('zebra'),
      contactWithoutCreatedDate('amber'),
      {
        ...contactWithoutCreatedDate('birch'),
        user: { _id: 'user-birch', username: 'birch', displayName: '' },
      },
    ];
    render(
      <ContactListPresentational
        selfId="me"
        filter=""
        contacts={contacts}
        onContactRemoved={() => {}}
        onFilterChange={() => {}}
      />,
    );
    const names = () =>
      screen.getAllByRole('button').map(button => button.textContent);
    expect(names()).toEqual([
      'contact-zebra',
      'contact-amber',
      'contact-birch',
    ]);
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort by' }), {
      target: { value: 'name' },
    });
    expect(names()).toEqual([
      'contact-amber',
      'contact-birch',
      'contact-zebra',
    ]);
    expect(contacts.map(item => item.user.username)).toEqual([
      'zebra',
      'amber',
      'birch',
    ]);
  });

  it('reports the removed contact from the clicked row', () => {
    const onContactRemoved = jest.fn();
    const alice = contact('alice');

    render(
      <ContactListPresentational
        selfId="me"
        filter=""
        contacts={[alice]}
        onContactRemoved={onContactRemoved}
        onFilterChange={() => {}}
      />,
    );

    fireEvent.click(screen.getByText('contact-alice'));

    expect(onContactRemoved).toHaveBeenCalledWith(alice);
  });
});

it('orders unnamed contacts using their usernames on either side of a comparison', () => {
  render(
    <ContactListPresentational
      selfId="viewer"
      filter=""
      contacts={[
        {
          ...contact('amber'),
          user: { _id: 'user-amber', username: 'amber', displayName: '' },
        },
        contact('birch'),
      ]}
      onContactRemoved={() => {}}
      onFilterChange={() => {}}
    />,
  );
  fireEvent.change(screen.getByRole('combobox', { name: 'Sort by' }), {
    target: { value: 'name' },
  });
  expect(
    screen.getAllByRole('button').map(button => button.textContent),
  ).toEqual(['contact-amber', 'contact-birch']);
});
