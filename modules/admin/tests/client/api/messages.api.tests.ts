import axios, { type AxiosResponse } from 'axios';

import {
  getMessages,
  getScammerRecipients,
  sendScammerWarning,
} from '@/modules/admin/client/api/messages.api';

const axiosMock = jest.mocked(axios);
const AxiosHeaders =
  jest.requireActual<typeof import('axios')>('axios').AxiosHeaders;

function response<T>(data: T): AxiosResponse<T> {
  const headers = new AxiosHeaders();
  return { data, status: 200, statusText: 'OK', headers, config: { headers } };
}

type AdminMessage = { _id: string };
type ScammerRecipients = { recipients: string[] };
type ScammerWarningResult = { sent: number };

jest.mock('axios', () =>
  jest.requireActual('@/modules/core/tests/client/api/axios.mock.js'),
);

afterEach(() => {
  jest.clearAllMocks();
});

describe('admin messages api', () => {
  it('fetches messages between two users', async () => {
    const data: AdminMessage[] = [{ _id: 'message-1' }];
    axiosMock.post.mockResolvedValueOnce(response(data));

    await expect(getMessages('user-1', 'user-2')).resolves.toBe(data);
    expect(axiosMock.post).toHaveBeenCalledWith('/api/admin/messages', {
      user1: 'user-1',
      user2: 'user-2',
    });
  });

  it('fetches scammer recipients', async () => {
    const data: ScammerRecipients = { recipients: [] };
    axiosMock.post.mockResolvedValueOnce(response(data));

    await expect(getScammerRecipients('scammer')).resolves.toBe(data);
    expect(axiosMock.post).toHaveBeenCalledWith(
      '/api/admin/messages/scammer-recipients',
      { username: 'scammer' },
    );
  });

  it('sends a scammer warning', async () => {
    const data: ScammerWarningResult = { sent: 2 };
    axiosMock.post.mockResolvedValueOnce(response(data));

    await expect(
      sendScammerWarning('scammer', 'Please ignore this', 'request-1'),
    ).resolves.toBe(data);
    expect(axiosMock.post).toHaveBeenCalledWith(
      '/api/admin/messages/scammer-warning',
      {
        username: 'scammer',
        content: 'Please ignore this',
        requestId: 'request-1',
      },
    );
  });
});
