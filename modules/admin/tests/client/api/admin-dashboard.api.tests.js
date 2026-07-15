import axios from 'axios';

import { getAdminDashboard } from '@/modules/admin/client/api/admin-dashboard.api';

jest.mock('axios');

afterEach(() => {
  jest.clearAllMocks();
});

describe('admin dashboard api', () => {
  it('fetches dashboard stats', async () => {
    const data = { negativeReviews: [], topMessengers: [] };
    axios.get.mockResolvedValueOnce({ data });

    await expect(getAdminDashboard()).resolves.toBe(data);
    expect(axios.get).toHaveBeenCalledWith('/api/admin/dashboard');
  });
});
