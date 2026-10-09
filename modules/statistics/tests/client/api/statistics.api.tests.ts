import axios, { type AxiosResponse } from 'axios';

import {
  get,
  type StatisticsResponse,
} from '@/modules/statistics/client/api/statistics.api';

const axiosMock = jest.mocked(axios);

function response<T>(data: T): AxiosResponse<T> {
  const { AxiosHeaders: ActualAxiosHeaders } =
    jest.requireActual<typeof import('axios')>('axios');
  const headers = new ActualAxiosHeaders();
  return { data, status: 200, statusText: 'OK', headers, config: { headers } };
}

jest.mock('axios', () =>
  jest.requireActual('@/modules/core/tests/client/api/axios.mock.js'),
);

afterEach(() => {
  jest.clearAllMocks();
});

describe('statistics api', () => {
  it('fetches statistics', async () => {
    const result = response<StatisticsResponse>({ total: 100 });
    axiosMock.get.mockResolvedValueOnce(result);

    await expect(get()).resolves.toBe(result);
    expect(axiosMock.get).toHaveBeenCalledWith('/api/statistics');
  });
});
