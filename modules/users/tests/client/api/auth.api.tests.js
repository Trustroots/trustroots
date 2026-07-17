import axios from 'axios';

import * as authApi from '@/modules/users/client/api/auth.api';

jest.mock('axios');

describe('auth.api', () => {
  beforeEach(() => {
    axios.post.mockReset();
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

  it('signs up with credentials', async () => {
    axios.post.mockResolvedValue({ data: { _id: 'user-2' } });

    await expect(
      authApi.signup({ email: 'ada@example.com', username: 'ada' }),
    ).resolves.toEqual({ _id: 'user-2' });
  });

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
