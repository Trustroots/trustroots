import { AxiosHeaders } from 'axios';
import axios from '@trustroots/core/http-client';
import {
  getGreeters,
  type Greeter,
} from '@/modules/pages/client/api/greeters.api';

vi.mock('@trustroots/core/http-client');

const mockedGet = vi.mocked(axios.get);

describe('greeters api', () => {
  it('fetches the public greeter roster', async () => {
    const data: { greeters: Greeter[] } = {
      greeters: [
        {
          _id: 'g1',
          username: 'river',
          displayName: 'River Host',
        },
      ],
    };
    mockedGet.mockResolvedValueOnce({
      data,
      status: 200,
      statusText: 'OK',
      headers: new AxiosHeaders(),
      config: { headers: new AxiosHeaders() },
    });

    await expect(getGreeters()).resolves.toBe(data);
    expect(mockedGet).toHaveBeenCalledWith('/api/greeters');
  });
});
