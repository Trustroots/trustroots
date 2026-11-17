import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import RemoveContactContainer from '@/modules/contacts/client/components/RemoveContactContainer';
import * as contactsApi from '@/modules/contacts/client/api/contacts.api';
import type RemoveContact from '@/modules/contacts/client/components/RemoveContact';

const removeMock = vi.mocked(contactsApi.remove);

vi.mock('@/modules/contacts/client/api/contacts.api', () => ({
  remove: vi.fn(),
}));

vi.mock('@/modules/contacts/client/components/RemoveContact', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
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
  return { default: MockRemoveContact };
});

describe('<RemoveContactContainer />', () => {
  beforeEach(() => {
    removeMock.mockReset();
  });

  it('removes the contact and calls onSuccess after the API request resolves', async () => {
    const onSuccess = vi.fn();
    const onCancel = vi.fn();
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

  it('re-enables the dialog when removing fails', async () => {
    const onSuccess = vi.fn();
    removeMock.mockRejectedValue(new Error('offline'));

    render(
      <RemoveContactContainer
        selfId="me"
        contact={{ _id: 'contact-1' }}
        show
        onSuccess={onSuccess}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('remove'));

    expect(screen.getByText('inProgress:true')).toBeInTheDocument();
    expect(await screen.findByText('inProgress:false')).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
