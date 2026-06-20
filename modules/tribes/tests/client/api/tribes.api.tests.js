import axios from 'axios';

import { join, leave, read, get } from '@/modules/tribes/client/api/tribes.api';

jest.mock('axios');

afterEach(() => {
  jest.clearAllMocks();
});

describe('tribes api', () => {
  it('joins a tribe', async () => {
    const updated = { _id: 'user-1' };
    axios.post.mockResolvedValueOnce({ data: updated });

    await expect(join('tribe-1')).resolves.toBe(updated);
    expect(axios.post).toHaveBeenCalledWith('/api/users/memberships/tribe-1');
  });

  it('leaves a tribe', async () => {
    const updated = { _id: 'user-1' };
    axios.delete.mockResolvedValueOnce({ data: updated });

    await expect(leave('tribe-1')).resolves.toBe(updated);
    expect(axios.delete).toHaveBeenCalledWith('/api/users/memberships/tribe-1');
  });

  it('reads tribes with the default limit', async () => {
    const tribes = [{ _id: 'tribe-1' }];
    axios.get.mockResolvedValueOnce({ data: tribes });

    await expect(read()).resolves.toBe(tribes);
    expect(axios.get).toHaveBeenCalledWith('/api/tribes', {
      params: { limit: 150 },
    });
  });

  it('reads tribes with a custom limit', async () => {
    axios.get.mockResolvedValueOnce({ data: [] });

    await read({ limit: 10 });
    expect(axios.get).toHaveBeenCalledWith('/api/tribes', {
      params: { limit: 10 },
    });
  });

  it('gets a single tribe by slug', async () => {
    const tribe = { _id: 'tribe-1', slug: 'hitchhikers' };
    axios.get.mockResolvedValueOnce({ data: tribe });

    await expect(get('hitchhikers')).resolves.toBe(tribe);
    expect(axios.get).toHaveBeenCalledWith('/api/tribes/hitchhikers');
  });
});
