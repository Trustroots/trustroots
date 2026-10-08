import { solveSigninChallenge } from '@/modules/users/client/utils/signin-challenge';
import axios from 'axios';

import * as authApi from '@/modules/users/client/api/auth.api';
jest.mock('@/modules/users/client/utils/signin-challenge');

jest.mock('axios', () =>
  jest.requireActual('@/modules/core/tests/client/api/axios.mock.js'),
);

describe('auth.api', () => {
  beforeEach(() => {
    axios.post.mockReset();
    axios.get.mockReset();
    axios.delete.mockReset();
  });

  it('signs in with credentials', async () => {
    axios.post.mockResolvedValue({ data: { _id: 'user-1' } });

    await expect(
      authApi.signin({ password: 'secret', username: 'ada' }),
    ).resolves.toEqual({ _id: 'user-1' });

    expect(axios.post).toHaveBeenCalledWith('/api/auth/signin', {
      password: 'secret',
      username: 'ada',
    });
  });

  it('solves one elevated-activity challenge and retries the same credentials', async () => {
    const challenge = { token: 'signed-challenge', difficulty: 14 };
    axios.post
      .mockRejectedValueOnce({
        response: { status: 429, data: { signinChallenge: challenge } },
      })
      .mockResolvedValueOnce({ data: { _id: 'sample' } });
    solveSigninChallenge.mockResolvedValue({
      token: challenge.token,
      solution: 42,
    });
    const credentials = { username: 'sample', password: 'example' };
    await expect(authApi.signin(credentials)).resolves.toEqual({
      _id: 'sample',
    });
    expect(solveSigninChallenge).toHaveBeenCalledWith(challenge);
    expect(axios.post).toHaveBeenLastCalledWith('/api/auth/signin', {
      ...credentials,
      signinProof: { token: challenge.token, solution: 42 },
    });
  });
  it.each([
    {},
    { response: { status: 400 } },
    { response: { status: 429 } },
    { response: { status: 429, data: {} } },
  ])('preserves ordinary sign-in failures', async error => {
    axios.post.mockRejectedValue(error);
    await expect(
      authApi.signin({ username: 'sample', password: 'example' }),
    ).rejects.toBe(error);
  });
  it('signs up with credentials', async () => {
    axios.post.mockResolvedValue({ data: { _id: 'user-2' } });

    await expect(
      authApi.signup({ email: 'ada@example.com', username: 'ada' }),
    ).resolves.toEqual({ _id: 'user-2' });
  });

  it.each([null, 'user-1'])(
    'checks the current session identity (%s)',
    async userId => {
      axios.get.mockResolvedValue({ data: { userId } });
      await expect(authApi.getSession()).resolves.toEqual({ userId });
      expect(axios.get).toHaveBeenCalledWith('/api/auth/session', {
        timeout: 10000,
      });
    },
  );

  it('validates signup fields', async () => {
    axios.post.mockResolvedValue({ data: { valid: true } });

    await expect(authApi.validateSignup({ username: 'ada' })).resolves.toEqual({
      valid: true,
    });
  });

  it('confirms email with a token', async () => {
    axios.post.mockResolvedValue({
      data: { profileMadePublic: true, user: { _id: 'user-3' } },
    });

    await expect(authApi.confirmEmail('token-123')).resolves.toEqual({
      profileMadePublic: true,
      user: { _id: 'user-3' },
    });
  });

  it('requests password reset instructions', async () => {
    axios.post.mockResolvedValue({ data: { message: 'Sent.' } });

    await expect(authApi.forgotPassword({ username: 'ada' })).resolves.toEqual({
      message: 'Sent.',
    });
  });

  it('resets password with a token', async () => {
    axios.post.mockResolvedValue({ data: { _id: 'user-4' } });

    await expect(
      authApi.resetPassword('reset-token', {
        newPassword: 'long-enough',
        verifyPassword: 'long-enough',
      }),
    ).resolves.toEqual({ _id: 'user-4' });
  });

  it('removes a profile with a token', async () => {
    axios.delete.mockResolvedValue({ data: { message: 'Removed.' } });

    await expect(authApi.removeProfile('remove-token')).resolves.toEqual({
      message: 'Removed.',
    });

    expect(axios.delete).toHaveBeenCalledWith(
      '/api/users/remove/remove-token',
      {
        data: { token: 'remove-token' },
      },
    );
  });
});
