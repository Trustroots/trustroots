import axios, { type AxiosResponse } from 'axios';

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

afterEach(() => {
  jest.clearAllMocks();
});

describe('users api', () => {
  it('updates the authenticated user', async () => {
    axiosMock.put.mockResolvedValueOnce(response({}));

    await update({ description: 'Hi there' });
    expect(axiosMock.put).toHaveBeenCalledWith('/api/users', {
      description: 'Hi there',
    });
  });

  it('fetches a user by username', async () => {
    const user = { _id: 'user-1', username: 'alice', displayName: 'Alice' };
    axiosMock.get.mockResolvedValueOnce(response(user));

    await expect(fetch('alice')).resolves.toBe(user);
    expect(axiosMock.get).toHaveBeenCalledWith('/api/users/alice');
  });

  it('fetches a mini user profile', async () => {
    const user = { _id: 'user-1', username: 'alice', displayName: 'Alice' };
    axiosMock.get.mockResolvedValueOnce(response(user));

    await expect(fetchMini('user-1')).resolves.toBe(user);
    expect(axiosMock.get).toHaveBeenCalledWith('/api/users/mini/user-1');
  });

  it('uploads an avatar', async () => {
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    axiosMock.post.mockResolvedValueOnce(response({}));

    await uploadAvatar(file);

    expect(axiosMock.post).toHaveBeenCalledWith(
      '/api/users-avatar',
      expect.any(FormData),
      { timeout: 120000 },
    );
  });

  it('does not set content type when the uploaded file has no type', async () => {
    const file = new File(['avatar'], 'avatar');
    axiosMock.post.mockResolvedValueOnce(response({}));

    await uploadAvatar(file);

    expect(axiosMock.post).toHaveBeenCalledWith(
      '/api/users-avatar',
      expect.any(FormData),
      { timeout: 120000 },
    );
  });

  it('changes the authenticated user password', async () => {
    axiosMock.post.mockResolvedValueOnce(response({ message: 'Updated.' }));

    await expect(
      changePassword({
        currentPassword: 'old-pass',
        newPassword: 'new-pass',
        verifyPassword: 'new-pass',
      }),
    ).resolves.toEqual({ message: 'Updated.' });

    expect(axiosMock.post).toHaveBeenCalledWith('/api/users/password', {
      currentPassword: 'old-pass',
      newPassword: 'new-pass',
      verifyPassword: 'new-pass',
    });
  });

  it('resends the email confirmation', async () => {
    axiosMock.post.mockResolvedValueOnce(response({}));

    await resendEmailConfirmation();

    expect(axiosMock.post).toHaveBeenCalledWith(
      '/api/auth/resend-confirmation',
    );
  });

  it('removes the authenticated profile', async () => {
    axiosMock.delete.mockResolvedValueOnce(response({ message: 'Removed.' }));

    await expect(removeProfile()).resolves.toEqual({ message: 'Removed.' });
    expect(axiosMock.delete).toHaveBeenCalledWith('/api/users');
  });

  it('removes a linked social account', async () => {
    axiosMock.delete.mockResolvedValueOnce(response({ message: 'Removed.' }));

    await expect(removeSocialAccount('github')).resolves.toEqual({
      message: 'Removed.',
    });
    expect(axiosMock.delete).toHaveBeenCalledWith('/api/users/accounts/github');
  });
});
