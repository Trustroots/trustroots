import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PasskeySettings from '../../../client/components/PasskeySettings.component';
import * as api from '../../../client/api/passkeys.api';

jest.mock('../../../client/api/passkeys.api');
const mocked = jest.mocked(api);
const key = { id: 'fictional-key', label: 'Laptop', createdAt: '2026-01-01' };

describe('Staff passkey settings', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mocked.getPasskeys.mockResolvedValue([key]);
    mocked.registerPasskey.mockResolvedValue();
    mocked.removePasskey.mockResolvedValue();
  });
  function credentials() {
    fireEvent.change(screen.getByLabelText('Current password'), {
      target: { value: 'fictional-password' },
    });
    fireEvent.change(screen.getByLabelText('Authenticator or recovery code'), {
      target: { value: '123456' },
    });
  }
  it('loads member credentials and adds a named passkey', async () => {
    render(<PasskeySettings />);
    await screen.findByText('Laptop');
    credentials();
    fireEvent.change(screen.getByLabelText('Passkey name'), {
      target: { value: 'Phone' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add passkey' }));
    await screen.findByText('Passkey added.');
    expect(mocked.registerPasskey).toHaveBeenCalledWith(
      'fictional-password',
      '123456',
      'Phone',
    );
    expect(screen.getByLabelText('Current password')).toHaveValue('');
    expect(screen.getByLabelText('Authenticator or recovery code')).toHaveValue(
      '',
    );
  });
  it('requires credentials to remove a passkey', async () => {
    render(<PasskeySettings />);
    const remove = await screen.findByRole('button', {
      name: 'Remove passkey Laptop',
    });
    expect(remove).toBeDisabled();
    credentials();
    fireEvent.click(remove);
    await screen.findByText('Passkey removed.');
    expect(mocked.removePasskey).toHaveBeenCalledWith(
      key.id,
      'fictional-password',
      '123456',
    );
  });
  it('shows loading and operation failures', async () => {
    mocked.getPasskeys.mockRejectedValueOnce(new Error('Unavailable'));
    mocked.registerPasskey.mockRejectedValueOnce({
      response: { data: { message: 'Try another device.' } },
    });
    render(<PasskeySettings />);
    await screen.findByText('Could not load passkeys.');
    credentials();
    fireEvent.change(screen.getByLabelText('Passkey name'), {
      target: { value: 'Phone' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add passkey' }));
    await screen.findByText('Try another device.');
    mocked.registerPasskey.mockRejectedValueOnce({});
    fireEvent.click(screen.getByRole('button', { name: 'Add passkey' }));
    await screen.findByText('Passkey request was not completed.');
    mocked.registerPasskey.mockRejectedValueOnce(
      new Error('Device request cancelled.'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add passkey' }));
    await screen.findByText('Device request cancelled.');
  });
  it('does not update an unmounted component after a late load', async () => {
    let resolve!: (value: api.MemberPasskey[]) => void;
    mocked.getPasskeys.mockReturnValue(
      new Promise(done => {
        resolve = done;
      }),
    );
    const view = render(<PasskeySettings />);
    view.unmount();
    resolve([]);
    await waitFor(() => expect(mocked.getPasskeys).toHaveBeenCalledTimes(1));
  });
  it('does not update an unmounted component after a late failure', async () => {
    let reject!: (error: Error) => void;
    mocked.getPasskeys.mockReturnValue(
      new Promise((resolve, fail) => {
        reject = fail;
      }),
    );
    const view = render(<PasskeySettings />);
    view.unmount();
    reject(new Error('Unavailable'));
    await waitFor(() => expect(mocked.getPasskeys).toHaveBeenCalledTimes(1));
  });
});
