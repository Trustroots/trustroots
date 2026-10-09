import axios, { type AxiosResponse } from 'axios';

import { searchUsers } from '@/modules/users/client/api/search-users.api';

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

describe('search-users api', () => {
  it('searches users by query string', async () => {
    const result = response([{ _id: 'user-1' }]);
    axiosMock.get.mockResolvedValueOnce(result);

    await expect(searchUsers('alice')).resolves.toBe(result);
    expect(axiosMock.get).toHaveBeenCalledWith('/api/users?search=alice', {
      timeout: 10000,
    });
  });
});

it('encodes punctuation in the query as data', async () => {
  axiosMock.get.mockResolvedValueOnce(response([]));
  await searchUsers('Alex & Sam');
  expect(axiosMock.get).toHaveBeenCalledWith(
    '/api/users?search=Alex%20%26%20Sam',
    {
      timeout: 10000,
    },
  );
});
