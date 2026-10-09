import axios, { type AxiosResponse } from 'axios';

import {
  get,
  send,
  type ReferenceThreadData,
} from '@/modules/references-thread/client/api/reference-thread.api';

jest.mock('axios', () =>
  jest.requireActual('@/modules/core/tests/client/api/axios.mock.js'),
);

const RealAxiosHeaders =
  jest.requireActual<typeof import('axios')>('axios').AxiosHeaders;

afterEach(() => {
  jest.clearAllMocks();
});

describe('reference-thread api', () => {
  it('gets a reference thread for a user', async () => {
    const data: ReferenceThreadData = {
      created: new Date('2020-01-01T00:00:00.000Z'),
      reference: 'yes',
    };
    const response: AxiosResponse<ReferenceThreadData> = {
      config: { headers: new RealAxiosHeaders() },
      data,
      headers: new RealAxiosHeaders(),
      status: 200,
      statusText: 'OK',
    };
    jest.mocked(axios.get).mockResolvedValueOnce(response);

    await expect(get('user-1')).resolves.toBe(data);
    expect(axios.get).toHaveBeenCalledWith('/api/references-thread/user-1');
  });

  it('sends a reference thread answer', async () => {
    const data = { _id: 'ref-1' };
    const response: AxiosResponse<typeof data> = {
      config: { headers: new RealAxiosHeaders() },
      data,
      headers: new RealAxiosHeaders(),
      status: 200,
      statusText: 'OK',
    };
    jest.mocked(axios.post).mockResolvedValueOnce(response);

    await expect(send('yes', 'user-1')).resolves.toBe(data);
    expect(axios.post).toHaveBeenCalledWith('/api/references-thread', {
      reference: 'yes',
      userTo: 'user-1',
    });
  });
});
