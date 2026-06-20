import axios from 'axios';

import { getThreads } from '@/modules/admin/client/api/threads.api';

jest.mock('axios');

afterEach(() => {
  jest.clearAllMocks();
});

describe('admin threads api', () => {
  it('fetches threads by user id and username', async () => {
    const data = [{ _id: 'thread-1' }];
    axios.post.mockResolvedValueOnce({ data });

    await expect(
      getThreads({ userId: 'user-1', username: 'alice' }),
    ).resolves.toBe(data);
    expect(axios.post).toHaveBeenCalledWith('/api/admin/threads', {
      userId: 'user-1',
      username: 'alice',
    });
  });

  it('defaults user id and username to empty strings', async () => {
    axios.post.mockResolvedValueOnce({ data: [] });

    await getThreads({});
    expect(axios.post).toHaveBeenCalledWith('/api/admin/threads', {
      userId: '',
      username: '',
    });
  });
});
