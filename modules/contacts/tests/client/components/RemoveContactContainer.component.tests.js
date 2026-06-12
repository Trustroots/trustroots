import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import RemoveContactContainer from '@/modules/contacts/client/components/RemoveContactContainer';
import * as contactsApi from '@/modules/contacts/client/api/contacts.api';

jest.mock('@/modules/contacts/client/api/contacts.api', () => ({
  remove: jest.fn(),
}));

jest.mock('@/modules/contacts/client/components/RemoveContact', () => {
  const React = require('react');
  const PropTypes = require('prop-types');
  function MockRemoveContact({ inProgress, onCancel, onRemove, show }) {
    return (
      <div>
        <div>{`show:${show}`}</div>
        <div>{`inProgress:${inProgress}`}</div>
        <button onClick={onRemove}>remove</button>
        <button onClick={onCancel}>cancel</button>
      </div>
    );
  }
  MockRemoveContact.propTypes = {
    inProgress: PropTypes.bool.isRequired,
    onCancel: PropTypes.func.isRequired,
    onRemove: PropTypes.func.isRequired,
    show: PropTypes.bool.isRequired,
  };
  return MockRemoveContact;
});

describe('<RemoveContactContainer />', () => {
  beforeEach(() => {
    contactsApi.remove.mockReset();
  });

  it('removes the contact and calls onSuccess after the API request resolves', async () => {
    const onSuccess = jest.fn();
    const onCancel = jest.fn();
    contactsApi.remove.mockResolvedValue();

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

    expect(contactsApi.remove).toHaveBeenCalledWith('contact-1');
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByText('cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
