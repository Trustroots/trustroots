import axios from '@/modules/core/client/api/http-client.js';
import {
  getGreeters,
  type Greeter,
} from '@/modules/pages/client/api/greeters.api';

jest.mock('@/modules/core/client/api/http-client.js');

const getMock = jest.mocked(axios.get);

describe('greeters api', () => {
  it('fetches the public greeter roster', async () => {
    const data: { greeters: Greeter[] } = {
      greeters: [{ _id: 'g1', username: 'river', displayName: 'River Host' }],
    };
    getMock.mockResolvedValueOnce({ data });

    await expect(getGreeters()).resolves.toBe(data);
    expect(getMock).toHaveBeenCalledWith('/api/greeters');
  });
});
