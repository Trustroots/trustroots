import axios, { type AxiosResponse } from 'axios';

import {
  getAcquisitionStories,
  resendAcquisitionStoryConfirmation,
} from '@/modules/admin/client/api/acquisition-stories.api';

const axiosMock = jest.mocked(axios);
const AxiosHeaders =
  jest.requireActual<typeof import('axios')>('axios').AxiosHeaders;

function response<T>(data: T): AxiosResponse<T> {
  const headers = new AxiosHeaders();
  return { data, status: 200, statusText: 'OK', headers, config: { headers } };
}

type AcquisitionStory = { _id: string };

jest.mock('axios', () =>
  jest.requireActual('@/modules/core/tests/client/api/axios.mock'),
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

  it('resends an acquisition story signup confirmation', async () => {
    const data = { message: 'Confirmation email sent.' };
    axiosMock.post.mockResolvedValueOnce(response(data));

    await expect(resendAcquisitionStoryConfirmation('user-1')).resolves.toBe(
      data,
    );
    expect(axiosMock.post).toHaveBeenCalledWith(
      '/api/admin/acquisition-stories/user-1/resend-confirmation',
    );
  });
});
