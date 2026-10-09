import axios, { type AxiosResponse } from 'axios';

import {
  reportMember,
  send,
  type SupportRequest,
} from '@/modules/support/client/api/support.api';

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

describe('support api', () => {
  it('sends a support request', async () => {
    const request: SupportRequest = { message: 'Help me' };
    const result = response({ ok: true });
    axiosMock.post.mockResolvedValueOnce(result);

    await expect(send(request)).resolves.toBe(result);
    expect(axiosMock.post).toHaveBeenCalledWith('/api/support', request);
  });

  it('reports a member through support', async () => {
    axiosMock.post.mockResolvedValueOnce(response({}));

    await reportMember({ username: 'samplemember' }, 'A report');
    expect(axiosMock.post).toHaveBeenCalledWith('/api/support', {
      message: 'A report',
      reportMember: 'samplemember',
    });
  });
});
