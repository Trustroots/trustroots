import axios, { type AxiosResponse } from 'axios';

import * as authApi from '@/modules/users/client/api/auth.api';

jest.mock('axios', () =>
  jest.requireActual('@/modules/core/tests/client/api/axios.mock.js'),
);

const axiosMock = jest.mocked(axios);
const AxiosHeaders =
  jest.requireActual<typeof import('axios')>('axios').AxiosHeaders;

function response<T>(data: T): AxiosResponse<T> {
  const headers = new AxiosHeaders();
  return { data, status: 200, statusText: 'OK', headers, config: { headers } };
}

describe('auth.api', () => {
  beforeEach(() => {
    axiosMock.post.mockReset();
    axiosMock.get.mockReset();
    axiosMock.delete.mockReset();
  });

  it('signs in with credentials', async () => {
    axiosMock.post.mockResolvedValue(response({ _id: 'user-1' }));

    await expect(
      authApi.signin({ password: 'secret', username: 'ada' }),
    ).resolves.toEqual({ _id: 'user-1' });

    expect(axiosMock.post).toHaveBeenCalledWith('/api/auth/signin', {
      password: 'secret',
      username: 'ada',
    });
  });

  it('signs up with credentials', async () => {
    axiosMock.post.mockResolvedValue(response({ _id: 'user-2' }));

    await expect(
      authApi.signup({
        email: 'ada@example.com',
        password: 'fictional-password',
        username: 'ada',
      }),
    ).resolves.toEqual({ _id: 'user-2' });
  });

  it.each([null, 'user-1'])(
    'checks the current session identity (%s)',
    async userId => {
      axiosMock.get.mockResolvedValue(response({ userId }));
      await expect(authApi.getSession()).resolves.toEqual({ userId });
      expect(axiosMock.get).toHaveBeenCalledWith('/api/auth/session', {
        timeout: 10000,
      });
    },
  );

  it('validates signup fields', async () => {
    axiosMock.post.mockResolvedValue(response({ valid: true }));

    await expect(authApi.validateSignup({ username: 'ada' })).resolves.toEqual({
      valid: true,
    });
  });

  it('confirms email with a token', async () => {
    axiosMock.post.mockResolvedValue(
      response({
        profileMadePublic: true,
        user: { _id: 'user-3' },
      }),
    );

    await expect(authApi.confirmEmail('token-123')).resolves.toEqual({
      profileMadePublic: true,
      user: { _id: 'user-3' },
    });
  });

  it('requests password reset instructions', async () => {
    axiosMock.post.mockResolvedValue(response({ message: 'Sent.' }));

    await expect(authApi.forgotPassword({ username: 'ada' })).resolves.toEqual({
      message: 'Sent.',
    });
  });

  it('resets password with a token', async () => {
    axiosMock.post.mockResolvedValue(response({ _id: 'user-4' }));

    await expect(
      authApi.resetPassword('reset-token', {
        newPassword: 'long-enough',
        verifyPassword: 'long-enough',
      }),
    ).resolves.toEqual({ _id: 'user-4' });
  });

  it('removes a profile with a token', async () => {
    axiosMock.delete.mockResolvedValue(response({ message: 'Removed.' }));

    await expect(authApi.removeProfile('remove-token')).resolves.toEqual({
      message: 'Removed.',
    });

    expect(axiosMock.delete).toHaveBeenCalledWith(
      '/api/users/remove/remove-token',
      {
        data: { token: 'remove-token' },
      },
    );
  });
});
