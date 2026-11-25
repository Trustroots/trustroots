import axios, { AxiosHeaders, type AxiosResponse } from 'axios';

import { getAccountActivity } from '@/modules/users/client/api/activity.api';
import type { AccountActivityPage } from '@/modules/users/shared/account-activity';

vi.mock('axios', async importOriginal => ({
  ...(await importOriginal<typeof import('axios')>()),
  ...(await import('@/modules/core/tests/client/api/axios.mock')),
}));

const axiosMock = vi.mocked(axios);

function response<T>(data: T): AxiosResponse<T> {
  const headers = new AxiosHeaders();
  return { data, status: 200, statusText: 'OK', headers, config: { headers } };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('account activity api', () => {
  it('fetches the first page with the declared activity response type', async () => {
    const page: AccountActivityPage = {
      events: [
        {
          eventType: 'session_created',
          createdAt: '2026-10-12T10:00:00.000Z',
        },
      ],
      nextCursor: 'opaque-cursor',
    };
    axiosMock.get.mockResolvedValueOnce(response(page));

    await expect(getAccountActivity()).resolves.toBe(page);
    expect(axiosMock.get).toHaveBeenCalledWith('/api/users/activity', {
      params: undefined,
    });
  });

  it('passes an opaque cursor when fetching the next page', async () => {
    const page: AccountActivityPage = { events: [], nextCursor: null };
    axiosMock.get.mockResolvedValueOnce(response(page));

    await expect(getAccountActivity('opaque-cursor')).resolves.toBe(page);
    expect(axiosMock.get).toHaveBeenCalledWith('/api/users/activity', {
      params: { cursor: 'opaque-cursor' },
    });
  });
});
