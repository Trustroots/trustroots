import axios, { type AxiosResponse } from 'axios';

import {
  getReferenceThreads,
  type ReferenceThread,
} from '@/modules/admin/client/api/admin-reference-threads.api';

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

describe('admin reference-threads api', () => {
  it('fetches reference threads', async () => {
    const data: ReferenceThread[] = [
      { _id: 'ref-1', created: '2025-01-02T00:00:00.000Z' },
    ];
    axiosMock.get.mockResolvedValueOnce(response(data));

    await expect(getReferenceThreads()).resolves.toBe(data);
    expect(axiosMock.get).toHaveBeenCalledWith('/api/admin/reference-threads');
  });
});
