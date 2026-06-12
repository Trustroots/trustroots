import axios from 'axios';

import { getVolunteers } from '@/modules/pages/client/api/volunteers.api';

jest.mock('axios');

afterEach(() => {
  jest.clearAllMocks();
});

describe('volunteers api', () => {
  it('fetches volunteers', async () => {
    const data = [{ name: 'Alice' }];
    axios.get.mockResolvedValueOnce({ data });

    await expect(getVolunteers()).resolves.toBe(data);
    expect(axios.get).toHaveBeenCalledWith('/api/volunteers');
  });
});
