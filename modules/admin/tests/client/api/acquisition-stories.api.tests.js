import axios from 'axios';

import { getAcquisitionStories } from '@/modules/admin/client/api/acquisition-stories.api';

jest.mock('axios', () =>
  jest.requireActual('@/modules/core/tests/client/api/axios.mock.js'),
);

afterEach(() => {
  jest.clearAllMocks();
});

describe('admin acquisition-stories api', () => {
  it('fetches acquisition stories', async () => {
    const data = [{ _id: 'story-1' }];
    axios.post.mockResolvedValueOnce({ data });

    await expect(getAcquisitionStories()).resolves.toBe(data);
    expect(axios.post).toHaveBeenCalledWith('/api/admin/acquisition-stories');
  });
});
