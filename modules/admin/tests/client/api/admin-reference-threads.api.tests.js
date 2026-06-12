import axios from 'axios';

import { getReferenceThreads } from '@/modules/admin/client/api/admin-reference-threads.api';

jest.mock('axios');

afterEach(() => {
  jest.clearAllMocks();
});

describe('admin reference-threads api', () => {
  it('fetches reference threads', async () => {
    const data = [{ _id: 'ref-1' }];
    axios.get.mockResolvedValueOnce({ data });

    await expect(getReferenceThreads()).resolves.toBe(data);
    expect(axios.get).toHaveBeenCalledWith('/api/admin/reference-threads');
  });
});
