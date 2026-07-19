import axios from 'axios';

import {
  changePassword,
  fetch,
  fetchMini,
  removeProfile,
  removeSocialAccount,
  resendEmailConfirmation,
  update,
  uploadAvatar,
} from '@/modules/users/client/api/users.api';

jest.mock('axios');

afterEach(() => {
  jest.clearAllMocks();
});

describe('users api', () => {
  it('updates the authenticated user', async () => {
    axios.put.mockResolvedValueOnce({});

    await update({ description: 'Hi there' });
    expect(axios.put).toHaveBeenCalledWith('/api/users', {
      description: 'Hi there',
    });
  });

  it('fetches a user by username', async () => {
    const user = { _id: 'user-1', username: 'alice' };
    axios.get.mockResolvedValueOnce({ data: user });

    await expect(fetch('alice')).resolves.toBe(user);
    expect(axios.get).toHaveBeenCalledWith('/api/users/alice');
  });

  it('fetches a mini user profile', async () => {
    const user = { _id: 'user-1', username: 'alice' };
    axios.get.mockResolvedValueOnce({ data: user });

    await expect(fetchMini('user-1')).resolves.toBe(user);
    expect(axios.get).toHaveBeenCalledWith('/api/users/mini/user-1');
  });

  it('uploads an avatar', async () => {
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    axios.post.mockResolvedValueOnce({});

    await uploadAvatar(file);

    expect(axios.post).toHaveBeenCalledWith(
      '/api/users-avatar',
      expect.any(FormData),
      {
        headers: { 'Content-Type': 'image/png' },
      },
    );
  });

  it('uses an octet-stream avatar content type when a file has none', async () => {
    const file = new File(['avatar'], 'avatar');
    axios.post.mockResolvedValueOnce({});

    await uploadAvatar(file);

    expect(axios.post).toHaveBeenCalledWith(
      '/api/users-avatar',
      expect.any(FormData),
      {
        headers: { 'Content-Type': 'application/octet-stream' },
      },
    );
  });

  it('changes the authenticated user password', async () => {
    axios.post.mockResolvedValueOnce({ data: { message: 'Updated.' } });

    await expect(
      changePassword({
        currentPassword: 'old-pass',
        newPassword: 'new-pass',
        verifyPassword: 'new-pass',
      }),
    ).resolves.toEqual({ message: 'Updated.' });

    expect(axios.post).toHaveBeenCalledWith('/api/users/password', {
      currentPassword: 'old-pass',
      newPassword: 'new-pass',
      verifyPassword: 'new-pass',
    });
  });

  it('resends the email confirmation', async () => {
    axios.post.mockResolvedValueOnce({});

    await resendEmailConfirmation();

    expect(axios.post).toHaveBeenCalledWith('/api/auth/resend-confirmation');
  });

  it('removes the authenticated profile', async () => {
    axios.delete.mockResolvedValueOnce({ data: { message: 'Removed.' } });

    await expect(removeProfile()).resolves.toEqual({ message: 'Removed.' });
    expect(axios.delete).toHaveBeenCalledWith('/api/users');
  });

  it('removes a linked social account', async () => {
    axios.delete.mockResolvedValueOnce({ data: { message: 'Removed.' } });

    await expect(removeSocialAccount('github')).resolves.toEqual({
      message: 'Removed.',
    });
    expect(axios.delete).toHaveBeenCalledWith('/api/users/accounts/github');
  });
});
