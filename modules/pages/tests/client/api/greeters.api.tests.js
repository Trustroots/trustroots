import axios from '@/modules/core/client/api/http-client.js';
import { getGreeters } from '@/modules/pages/client/api/greeters.api';

jest.mock('@/modules/core/client/api/http-client.js');

describe('greeters api', () => {
  it('fetches the public greeter roster', async () => {
    const data = {
      greeters: [{ _id: 'g1', username: 'river', displayName: 'River Host' }],
    };
    axios.get.mockResolvedValueOnce({ data });

    await expect(getGreeters()).resolves.toBe(data);
    expect(axios.get).toHaveBeenCalledWith('/api/greeters');
  });
});
