import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import MfaSettings from '@/modules/users/client/components/MfaSettings.component';
import * as mfaApi from '@/modules/users/client/api/mfa.api';

const mockSetUser = jest.fn();

jest.mock('@/modules/users/client/api/mfa.api');
jest.mock('@/modules/core/client/react-app/auth', () => ({
  useAuth: () => ({ setUser: mockSetUser }),
}));

describe('MfaSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetUser.mockImplementation(userOrUpdater =>
      typeof userOrUpdater === 'function' ? userOrUpdater({}) : userOrUpdater,
    );
    mfaApi.getMfaStatus.mockResolvedValue({
      enabled: false,
      recoveryCodesRemaining: 0,
    });
  });

  it('confirms the password, verifies setup, and shows recovery codes once', async () => {
    mfaApi.beginMfaEnrollment.mockResolvedValue({
      provisioningUri: 'otpauth://totp/Trustroots:member?secret=ABC',
      expires: '2026-10-09T12:00:00.000Z',
    });
    mfaApi.verifyMfaEnrollment.mockResolvedValue({
      enabled: true,
      recoveryCodes: ['RECOVERYCODE1', 'RECOVERYCODE2'],
      user: { _id: 'fictional-user' },
    });
    render(<MfaSettings />);

    await screen.findByText(/Add an authenticator app/);
    fireEvent.change(screen.getByLabelText('Confirm your password'), {
      target: { value: 'password' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Set up authenticator' }),
    );
    expect(await screen.findByText(/otpauth:\/\/totp/)).toBeInTheDocument();
    expect(mfaApi.beginMfaEnrollment).toHaveBeenCalledWith('password');

    fireEvent.change(screen.getByLabelText('Current authenticator code'), {
      target: { value: '123456' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Enable authenticator MFA' }),
    );
    expect(await screen.findByText('RECOVERYCODE1')).toBeInTheDocument();
    expect(mockSetUser).toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', { name: 'I have saved these codes' }),
    );
    await waitFor(() =>
      expect(screen.queryByText('RECOVERYCODE1')).not.toBeInTheDocument(),
    );
  });

  it('shows a useful error when settings cannot load or setup fails', async () => {
    mfaApi.getMfaStatus.mockRejectedValueOnce(new Error('offline'));
    render(<MfaSettings />);
    expect(
      await screen.findByText('Could not load authenticator settings.'),
    ).toBeInTheDocument();
  });

  it('ignores settings results after the component unmounts', async () => {
    let resolveStatus;
    mfaApi.getMfaStatus.mockReturnValue(
      new Promise(resolve => {
        resolveStatus = resolve;
      }),
    );
    const { unmount } = render(<MfaSettings />);
    unmount();
    resolveStatus({ enabled: false, recoveryCodesRemaining: 0 });
    await Promise.resolve();
  });

  it('reports setup and verification failures', async () => {
    mfaApi.beginMfaEnrollment.mockRejectedValue({
      response: { data: { message: 'Password confirmation failed.' } },
    });
    render(<MfaSettings />);
    await screen.findByText(/Add an authenticator app/);
    fireEvent.change(screen.getByLabelText('Confirm your password'), {
      target: { value: 'wrong' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Set up authenticator' }),
    );
    expect(
      await screen.findByText('Password confirmation failed.'),
    ).toBeInTheDocument();

    mfaApi.beginMfaEnrollment.mockResolvedValue({
      provisioningUri: 'otpauth://totp/Trustroots:member?secret=ABC',
      expires: '2026-10-09T12:00:00.000Z',
    });
    mfaApi.verifyMfaEnrollment.mockRejectedValue(new Error('bad code'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Set up authenticator' }),
    );
    await screen.findByText(/otpauth:\/\/totp/);
    fireEvent.change(screen.getByLabelText('Current authenticator code'), {
      target: { value: '000000' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Enable authenticator MFA' }),
    );
    expect(
      await screen.findByText('Something went wrong.'),
    ).toBeInTheDocument();
  });

  it('replaces recovery codes after confirming password and factor', async () => {
    mfaApi.getMfaStatus.mockResolvedValue({
      enabled: true,
      recoveryCodesRemaining: 1,
    });
    mfaApi.regenerateMfaRecoveryCodes.mockResolvedValue({
      recoveryCodes: ['NEWCODE12345'],
    });
    render(<MfaSettings />);

    await screen.findByText(/Authenticator MFA is enabled/);
    fireEvent.change(screen.getByLabelText('Current password'), {
      target: { value: 'password' },
    });
    fireEvent.change(
      screen.getAllByLabelText('Authenticator or recovery code')[0],
      {
        target: { value: '123456' },
      },
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Replace recovery codes' }),
    );
    expect(await screen.findByText('NEWCODE12345')).toBeInTheDocument();
    expect(mfaApi.regenerateMfaRecoveryCodes).toHaveBeenCalledWith(
      'password',
      '123456',
    );
  });

  it('reports management errors and keeps the controls available', async () => {
    mfaApi.getMfaStatus.mockResolvedValue({
      enabled: true,
      recoveryCodesRemaining: 2,
    });
    mfaApi.regenerateMfaRecoveryCodes.mockRejectedValue({
      response: { data: { message: 'Password confirmation failed.' } },
    });
    render(<MfaSettings />);

    await screen.findByText(/Authenticator MFA is enabled/);
    fireEvent.change(screen.getByLabelText('Current password'), {
      target: { value: 'wrong' },
    });
    fireEvent.change(
      screen.getAllByLabelText('Authenticator or recovery code')[0],
      {
        target: { value: '000000' },
      },
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Replace recovery codes' }),
    );
    expect(
      await screen.findByText('Password confirmation failed.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Replace recovery codes' }),
    ).toBeEnabled();
  });

  it('disables MFA after password and factor confirmation', async () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    mfaApi.getMfaStatus.mockResolvedValue({
      enabled: true,
      recoveryCodesRemaining: 2,
    });
    mfaApi.disableMfa.mockResolvedValue({ enabled: false });
    render(<MfaSettings />);

    await screen.findByText(/Authenticator MFA is enabled/);
    fireEvent.change(screen.getByLabelText('Confirm your password'), {
      target: { value: 'password' },
    });
    fireEvent.change(
      screen.getAllByLabelText('Authenticator or recovery code')[1],
      {
        target: { value: '123456' },
      },
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Disable authenticator MFA' }),
    );

    await waitFor(() =>
      expect(mfaApi.disableMfa).toHaveBeenCalledWith('password', '123456'),
    );
    expect(mockSetUser).toHaveBeenCalledWith(null);
    consoleError.mockRestore();
  });

  it('reports failed MFA disable requests', async () => {
    mfaApi.getMfaStatus.mockResolvedValue({
      enabled: true,
      recoveryCodesRemaining: 2,
    });
    mfaApi.disableMfa.mockRejectedValue({
      response: { data: { message: 'Authenticator code is invalid.' } },
    });
    render(<MfaSettings />);

    await screen.findByText(/Authenticator MFA is enabled/);
    fireEvent.change(screen.getByLabelText('Confirm your password'), {
      target: { value: 'password' },
    });
    fireEvent.change(
      screen.getAllByLabelText('Authenticator or recovery code')[1],
      { target: { value: '000000' } },
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Disable authenticator MFA' }),
    );

    expect(
      await screen.findByText('Authenticator code is invalid.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Disable authenticator MFA' }),
    ).toBeEnabled();
  });
});
