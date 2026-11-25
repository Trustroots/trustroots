import axios, { type AxiosResponse } from 'axios';

import {
  flagAcquisitionStoryMember,
  getAcquisitionStories,
  resendAcquisitionStoryConfirmation,
} from '@/modules/admin/client/api/acquisition-stories.api';

const axiosMock = vi.mocked(axios);
const AxiosHeaders = (await vi.importActual<typeof import('axios')>('axios'))
  .AxiosHeaders;

function response<T>(data: T): AxiosResponse<T> {
  const headers = new AxiosHeaders();
  return { data, status: 200, statusText: 'OK', headers, config: { headers } };
}

type AcquisitionStory = { _id: string };

vi.mock(
  'axios',
  async () => await import('@/modules/core/tests/client/api/axios.mock'),
);

afterEach(() => {
  vi.clearAllMocks();
});

describe('admin acquisition-stories api', () => {
  it('flags an acquisition story member for follow-up', async () => {
    axiosMock.post.mockResolvedValueOnce(response({ flagged: true }));

    await flagAcquisitionStoryMember('member/1');

    expect(axiosMock.post).toHaveBeenCalledWith(
      '/api/admin/acquisition-stories/member%2F1/flag',
    );
  });

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
