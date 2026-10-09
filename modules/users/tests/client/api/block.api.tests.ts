import axios, { type AxiosResponse } from 'axios';

import { block, unblock, list } from '@/modules/users/client/api/block.api';

jest.mock('axios', () =>
  jest.requireActual('@/modules/core/tests/client/api/axios.mock.js'),
);

const axiosMock = jest.mocked(axios);
const AxiosHeaders =
  jest.requireActual<typeof import('axios')>('axios').AxiosHeaders;

function response<T>(data: T): AxiosResponse<T> {
  const headers = new AxiosHeaders();
  return { data, status: 200, statusText: 'OK', headers, config: { headers } };
}

afterEach(() => {
  jest.clearAllMocks();
});

describe('block api', () => {
  it('blocks a member', async () => {
    const data = { blocked: true };
    axiosMock.put.mockResolvedValueOnce(response(data));

    await expect(block('spammer')).resolves.toBe(data);
    expect(axiosMock.put).toHaveBeenCalledWith('/api/blocked-users/spammer');
  });

  it('unblocks a member', async () => {
    const data = { blocked: false };
    axiosMock.delete.mockResolvedValueOnce(response(data));

    await expect(unblock('spammer')).resolves.toBe(data);
    expect(axiosMock.delete).toHaveBeenCalledWith('/api/blocked-users/spammer');
  });

  it('lists blocked members', async () => {
    const data = ['spammer', 'troll'];
    axiosMock.get.mockResolvedValueOnce(response(data));

    await expect(list()).resolves.toBe(data);
    expect(axiosMock.get).toHaveBeenCalledWith('/api/blocked-users');
  });
});
