import axios from 'axios';

import {
  getAcquisitionStories,
  getAcquisitionStoriesAnalysis,
} from '@/modules/admin/client/api/acquisition-stories.api';

jest.mock('axios');

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

  it('fetches acquisition stories analysis', async () => {
    const data = { total: 5 };
    axios.post.mockResolvedValueOnce({ data });

    await expect(getAcquisitionStoriesAnalysis()).resolves.toBe(data);
    expect(axios.post).toHaveBeenCalledWith(
      '/api/admin/acquisition-stories/analysis',
    );
  });
});
