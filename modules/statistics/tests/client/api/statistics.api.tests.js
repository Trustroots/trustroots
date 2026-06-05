import axios from 'axios';

import { get } from '@/modules/statistics/client/api/statistics.api';

jest.mock('axios');

afterEach(() => {
  jest.clearAllMocks();
});

describe('statistics api', () => {
  it('fetches statistics', async () => {
    const response = { data: { members: 100 } };
    axios.get.mockResolvedValueOnce(response);

    await expect(get()).resolves.toBe(response);
    expect(axios.get).toHaveBeenCalledWith('/api/statistics');
  });
});
