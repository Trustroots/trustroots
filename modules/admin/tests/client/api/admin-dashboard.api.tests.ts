import axios, { type AxiosResponse } from 'axios';

import {
  getAdminDashboard,
  type AdminDashboard,
} from '@/modules/admin/client/api/admin-dashboard.api';

const axiosMock = jest.mocked(axios);
const AxiosHeaders =
  jest.requireActual<typeof import('axios')>('axios').AxiosHeaders;

function response<T>(data: T): AxiosResponse<T> {
  const headers = new AxiosHeaders();
  return { data, status: 200, statusText: 'OK', headers, config: { headers } };
}

jest.mock('axios', () =>
  jest.requireActual('@/modules/core/tests/client/api/axios.mock.js'),
);

afterEach(() => {
  jest.clearAllMocks();
});

describe('admin dashboard api', () => {
  it('fetches dashboard stats', async () => {
    const data: AdminDashboard = {
      negativeExperiences: [],
      threadVotes: [],
      topMessengers: [],
    };
    axiosMock.get.mockResolvedValueOnce(response(data));

    await expect(getAdminDashboard()).resolves.toBe(data);
    expect(axiosMock.get).toHaveBeenCalledWith('/api/admin/dashboard');
  });
});
