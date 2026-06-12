import axios from 'axios';

import { update, fetch } from '@/modules/users/client/api/users.api';

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
