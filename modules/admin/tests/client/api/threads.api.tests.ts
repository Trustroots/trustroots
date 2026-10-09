import axios, { type AxiosResponse } from 'axios';

import {
  getThreads,
  type AdminThread,
} from '@/modules/admin/client/api/threads.api';

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

describe('admin threads api', () => {
  it('fetches threads by user id and username', async () => {
    const data: AdminThread[] = [
      {
        _id: 'thread-1',
        userFromProfile: [],
        userToProfile: [],
        read: false,
        updated: '2025-01-02T00:00:00.000Z',
      },
    ];
    axiosMock.post.mockResolvedValueOnce(response(data));

    const options: Parameters<typeof getThreads>[0] = {
      userId: 'user-1',
      username: 'alice',
    };
    await expect(getThreads(options)).resolves.toBe(data);
    expect(axiosMock.post).toHaveBeenCalledWith('/api/admin/threads', {
      userId: 'user-1',
      username: 'alice',
    });
  });

  it('defaults user id and username to empty strings', async () => {
    axiosMock.post.mockResolvedValueOnce(response([]));

    await getThreads({});
    expect(axiosMock.post).toHaveBeenCalledWith('/api/admin/threads', {
      userId: '',
      username: '',
    });
  });
});
