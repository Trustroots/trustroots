import axios, { type AxiosResponse } from 'axios';

import {
  get,
  getCharts,
  type StatisticsResponse,
} from '@/modules/statistics/client/api/statistics.api';

const axiosMock = vi.mocked(axios);

const { AxiosHeaders: ActualAxiosHeaders } =
  await vi.importActual<typeof import('axios')>('axios');

function response<T>(data: T): AxiosResponse<T> {
  const headers = new ActualAxiosHeaders();
  return { data, status: 200, statusText: 'OK', headers, config: { headers } };
}

vi.mock(
  'axios',
  async () => await import('@/modules/core/tests/client/api/axios.mock'),
);

afterEach(() => {
  vi.clearAllMocks();
});

describe('statistics api', () => {
  it('fetches statistics', async () => {
    const result = response<StatisticsResponse>({ total: 100 });
    axiosMock.get.mockResolvedValueOnce(result);

    await expect(get()).resolves.toBe(result);
    expect(axiosMock.get).toHaveBeenCalledWith('/api/statistics');
  });
});

it('fetches public charts separately from the summary', async () => {
  const result = response({ weeks: [] });
  axiosMock.get.mockResolvedValueOnce(result);

  await expect(getCharts()).resolves.toBe(result);
  expect(axiosMock.get).toHaveBeenCalledWith('/api/statistics/charts');
});
