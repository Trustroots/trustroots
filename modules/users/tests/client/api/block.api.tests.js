import axios from 'axios';

import { block, unblock, list } from '@/modules/users/client/api/block.api';

jest.mock('axios');

afterEach(() => {
  jest.clearAllMocks();
});

describe('block api', () => {
  it('blocks a member', async () => {
    const data = { blocked: true };
    axios.put.mockResolvedValueOnce({ data });

    await expect(block('spammer')).resolves.toBe(data);
    expect(axios.put).toHaveBeenCalledWith('/api/blocked-users/spammer');
  });

  it('unblocks a member', async () => {
    const data = { blocked: false };
    axios.delete.mockResolvedValueOnce({ data });

    await expect(unblock('spammer')).resolves.toBe(data);
    expect(axios.delete).toHaveBeenCalledWith('/api/blocked-users/spammer');
  });

  it('lists blocked members', async () => {
    const data = ['spammer', 'troll'];
    axios.get.mockResolvedValueOnce({ data });

    await expect(list()).resolves.toBe(data);
    expect(axios.get).toHaveBeenCalledWith('/api/blocked-users');
  });
});
