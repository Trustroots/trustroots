import axios from 'axios';

import { searchUsers } from '@/modules/users/client/api/search-users.api';

jest.mock('axios', () =>
  jest.requireActual('@/modules/core/tests/client/api/axios.mock.js'),
);

afterEach(() => {
  jest.clearAllMocks();
});

describe('search-users api', () => {
  it('searches users by query string', async () => {
    const response = { data: [{ _id: 'user-1' }] };
    axios.get.mockResolvedValueOnce(response);

    await expect(searchUsers('alice')).resolves.toBe(response);
    expect(axios.get).toHaveBeenCalledWith('/api/users?search=alice', {
      timeout: 10000,
    });
  });
});

it('encodes punctuation in the query as data', async () => {
  axios.get.mockResolvedValueOnce({ data: [] });
  await searchUsers('Alex & Sam');
  expect(axios.get).toHaveBeenCalledWith('/api/users?search=Alex%20%26%20Sam', {
    timeout: 10000,
  });
});
