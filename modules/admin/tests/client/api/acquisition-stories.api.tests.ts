import axios, { type AxiosResponse } from 'axios';

import {
  getAcquisitionStories,
  getAcquisitionStoriesAnalysis,
} from '@/modules/admin/client/api/acquisition-stories.api';

const axiosMock = jest.mocked(axios);
const AxiosHeaders =
  jest.requireActual<typeof import('axios')>('axios').AxiosHeaders;

function response<T>(data: T): AxiosResponse<T> {
  const headers = new AxiosHeaders();
  return { data, status: 200, statusText: 'OK', headers, config: { headers } };
}

type AcquisitionStory = { _id: string };
type AcquisitionStoriesAnalysis = { total: number };

jest.mock('axios', () =>
  jest.requireActual('@/modules/core/tests/client/api/axios.mock.js'),
);

afterEach(() => {
  jest.clearAllMocks();
});

describe('admin acquisition-stories api', () => {
  it('fetches acquisition stories', async () => {
    const data: AcquisitionStory[] = [{ _id: 'story-1' }];
    axiosMock.post.mockResolvedValueOnce(response(data));

    await expect(getAcquisitionStories()).resolves.toBe(data);
    expect(axiosMock.post).toHaveBeenCalledWith(
      '/api/admin/acquisition-stories',
    );
  });

  it('fetches acquisition stories analysis', async () => {
    const data: AcquisitionStoriesAnalysis = { total: 5 };
    axiosMock.post.mockResolvedValueOnce(response(data));

    await expect(getAcquisitionStoriesAnalysis()).resolves.toBe(data);
    expect(axiosMock.post).toHaveBeenCalledWith(
      '/api/admin/acquisition-stories/analysis',
    );
  });
});
