import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import RemoveContactContainer from '@/modules/contacts/client/components/RemoveContactContainer';
import * as contactsApi from '@/modules/contacts/client/api/contacts.api';
import type RemoveContact from '@/modules/contacts/client/components/RemoveContact';

const removeMock = jest.mocked(contactsApi.remove);

jest.mock('@/modules/contacts/client/api/contacts.api', () => ({
  remove: jest.fn(),
}));

jest.mock('@/modules/contacts/client/components/RemoveContact', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  function MockRemoveContact({
    inProgress,
    onCancel,
    onRemove,
    show,
  }: React.ComponentProps<typeof RemoveContact>) {
    return (
      <div>
        <div>{`show:${show}`}</div>
        <div>{`inProgress:${inProgress}`}</div>
        <button onClick={onRemove}>remove</button>
        <button onClick={onCancel}>cancel</button>
      </div>
    );
  }
  return MockRemoveContact;
});

describe('<RemoveContactContainer />', () => {
  beforeEach(() => {
    removeMock.mockReset();
  });

  it('removes the contact and calls onSuccess after the API request resolves', async () => {
    const onSuccess = jest.fn();
    const onCancel = jest.fn();
    removeMock.mockResolvedValue();

    render(
      <RemoveContactContainer
        selfId="me"
        contact={{ _id: 'contact-1' }}
        show
        onSuccess={onSuccess}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByText('show:true')).toBeInTheDocument();

    fireEvent.click(screen.getByText('remove'));

    expect(removeMock).toHaveBeenCalledWith('contact-1');
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByText('cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
