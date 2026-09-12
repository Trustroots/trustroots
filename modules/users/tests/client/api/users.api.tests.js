import axios from 'axios';

import { update, fetch, fetchMini } from '@/modules/users/client/api/users.api';

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
});

it('fetches the minimal recipient by id', async () => {
  const user = { _id: 'friend-1' };
  axios.get.mockResolvedValue({ data: user });
  await expect(fetchMini('friend-1')).resolves.toBe(user);
  expect(axios.get).toHaveBeenCalledWith('/api/users/mini/friend-1');
});
