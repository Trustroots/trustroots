import axios from 'axios';

import { getMessages } from '@/modules/admin/client/api/messages.api';

jest.mock('axios');

afterEach(() => {
  jest.clearAllMocks();
});

describe('admin messages api', () => {
  it('fetches messages between two users', async () => {
    const data = [{ _id: 'message-1' }];
    axios.post.mockResolvedValueOnce({ data });

    await expect(getMessages('user-1', 'user-2')).resolves.toBe(data);
    expect(axios.post).toHaveBeenCalledWith('/api/admin/messages', {
      user1: 'user-1',
      user2: 'user-2',
    });
  });
});
