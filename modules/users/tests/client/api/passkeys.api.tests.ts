import axios from 'axios';
import {
  startRegistration,
  startAuthentication,
} from '@simplewebauthn/browser';
import * as api from '../../../client/api/passkeys.api';

jest.mock('axios', () =>
  jest.requireActual('@/modules/core/tests/client/api/axios.mock.js'),
);
jest.mock('@simplewebauthn/browser', () => ({
  startRegistration: jest.fn(),
  startAuthentication: jest.fn(),
}));
const http = axios as jest.Mocked<typeof axios>;
const response = (data: unknown) =>
  ({ data } as Awaited<ReturnType<typeof axios.post>>);

describe('Passkey API', () => {
  beforeEach(() => jest.clearAllMocks());
  it('lists member passkeys', async () => {
    http.get.mockResolvedValue(response([{ id: 'key', label: 'Laptop' }]));
    await expect(api.getPasskeys()).resolves.toEqual([
      { id: 'key', label: 'Laptop' },
    ]);
    expect(http.get).toHaveBeenCalledWith('/api/users/passkeys');
  });
  it('registers only the browser-verified credential with the issued ceremony', async () => {
    http.post
      .mockResolvedValueOnce(
        response({
          ceremonyId: 'ceremony',
          options: { challenge: 'challenge' },
        }),
      )
      .mockResolvedValueOnce(response({ registered: true }));
    jest
      .mocked(startRegistration)
      .mockResolvedValue({ id: 'key' } as Awaited<
        ReturnType<typeof startRegistration>
      >);
    await api.registerPasskey('password', 'code', 'Laptop');
    expect(http.post).toHaveBeenNthCalledWith(
      1,
      '/api/users/passkeys/register/options',
      { currentPassword: 'password', code: 'code', label: 'Laptop' },
    );
    expect(startRegistration).toHaveBeenCalledWith({
      optionsJSON: { challenge: 'challenge' },
    });
    expect(http.post).toHaveBeenLastCalledWith(
      '/api/users/passkeys/register/verify',
      { ceremonyId: 'ceremony', response: { id: 'key' } },
    );
  });
  it('completes a staged sign-in using the browser authenticator', async () => {
    http.post
      .mockResolvedValueOnce(
        response({
          ceremonyId: 'ceremony',
          options: { challenge: 'challenge' },
        }),
      )
      .mockResolvedValueOnce(response({ _id: 'member', username: 'member' }));
    jest
      .mocked(startAuthentication)
      .mockResolvedValue({ id: 'key' } as Awaited<
        ReturnType<typeof startAuthentication>
      >);
    await expect(api.signinWithPasskey()).resolves.toEqual({
      _id: 'member',
      username: 'member',
    });
    expect(startAuthentication).toHaveBeenCalledWith({
      optionsJSON: { challenge: 'challenge' },
    });
    expect(http.post).toHaveBeenLastCalledWith('/api/auth/passkeys/verify', {
      ceremonyId: 'ceremony',
      response: { id: 'key' },
    });
  });
  it('requires confirmed credentials to remove an encoded credential identifier', async () => {
    http.delete.mockResolvedValue(response({ removed: true }));
    await api.removePasskey('key/id', 'password', 'code');
    expect(http.delete).toHaveBeenCalledWith('/api/users/passkeys/key%2Fid', {
      data: { currentPassword: 'password', code: 'code' },
    });
  });
  it('does not submit a credential when the browser ceremony fails', async () => {
    http.post.mockResolvedValue(
      response({ ceremonyId: 'ceremony', options: {} }),
    );
    jest.mocked(startRegistration).mockRejectedValue(new Error('Cancelled'));
    await expect(
      api.registerPasskey('password', 'code', 'Laptop'),
    ).rejects.toThrow('Cancelled');
    expect(http.post).toHaveBeenCalledTimes(1);
  });
});
