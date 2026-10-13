import axios from 'axios';
import * as mfaApi from '@/modules/users/client/api/mfa.api';

jest.mock('axios', () =>
  jest.requireActual('@/modules/core/tests/client/api/axios.mock.js'),
);

const mockedAxios = jest.mocked(axios);

describe('mfa.api', () => {
  beforeEach(() => {
    mockedAxios.get.mockReset();
    mockedAxios.post.mockReset();
  });

  it('loads MFA status', async () => {
    mockedAxios.get.mockResolvedValue({
      data: { enabled: true, recoveryCodesRemaining: 8 },
    });
    await expect(mfaApi.getMfaStatus()).resolves.toEqual({
      enabled: true,
      recoveryCodesRemaining: 8,
    });
    expect(axios.get).toHaveBeenCalledWith('/api/users/mfa');
  });

  it('starts enrolment with password confirmation', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        provisioningUri: 'otpauth://totp/Trustroots:member',
        expires: 'later',
      },
    });
    await expect(mfaApi.beginMfaEnrollment('password')).resolves.toEqual({
      provisioningUri: 'otpauth://totp/Trustroots:member',
      expires: 'later',
    });
    expect(axios.post).toHaveBeenCalledWith('/api/users/mfa/enrol', {
      currentPassword: 'password',
    });
  });

  it('confirms enrolment', async () => {
    mockedAxios.post.mockResolvedValue({
      data: { enabled: true, recoveryCodes: ['code'] },
    });
    await expect(mfaApi.verifyMfaEnrollment('123456')).resolves.toEqual({
      enabled: true,
      recoveryCodes: ['code'],
    });
  });

  it('replaces recovery codes with password and factor confirmation', async () => {
    mockedAxios.post.mockResolvedValue({
      data: { recoveryCodes: ['new-code'] },
    });
    await expect(
      mfaApi.regenerateMfaRecoveryCodes('password', '654321'),
    ).resolves.toEqual({ recoveryCodes: ['new-code'] });
    expect(axios.post).toHaveBeenCalledWith('/api/users/mfa/recovery-codes', {
      currentPassword: 'password',
      code: '654321',
    });
  });

  it('disables MFA with password and factor confirmation', async () => {
    mockedAxios.post.mockResolvedValue({ data: { enabled: false } });
    await expect(mfaApi.disableMfa('password', '654321')).resolves.toEqual({
      enabled: false,
    });
    expect(axios.post).toHaveBeenCalledWith('/api/users/mfa/disable', {
      currentPassword: 'password',
      code: '654321',
    });
  });
});
