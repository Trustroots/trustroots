import axios from 'axios';

import { searchUsers } from '@/modules/users/client/api/search-users.api';

jest.mock('axios');

afterEach(() => {
  jest.clearAllMocks();
});

describe('search-users api', () => {
  it('searches users by query string', async () => {
    const response = { data: [{ _id: 'user-1' }] };
    axios.get.mockResolvedValueOnce(response);

    await expect(searchUsers('alice')).resolves.toBe(response);
    expect(axios.get).toHaveBeenCalledWith('/api/users?search=alice');
  });
});
