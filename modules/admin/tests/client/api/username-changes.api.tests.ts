import axios, { type AxiosResponse } from 'axios';

import {
  getUsernameChanges,
  type AdminUsernameChangesPage,
} from '@/modules/admin/client/api/username-changes.api';

jest.mock('axios', () =>
  jest.requireActual('@/modules/core/tests/client/api/axios.mock'),
);

const axiosMock = jest.mocked(axios);
const AxiosHeaders =
  jest.requireActual<typeof import('axios')>('axios').AxiosHeaders;

function response<T>(data: T): AxiosResponse<T> {
  const headers = new AxiosHeaders();
  return { data, status: 200, statusText: 'OK', headers, config: { headers } };
}

afterEach(() => jest.clearAllMocks());

it('fetches the requested username changes page', async () => {
  const data: AdminUsernameChangesPage = {
    changes: [
      {
        _id: 'user-1',
        currentUsername: 'sample-member',
        oldUsername: 'sample-old',
        newUsername: 'sample-member',
        changedAt: '2025-01-02T03:04:05.000Z',
        legacy: false,
      },
    ],
    page: 2,
    hasNextPage: false,
    range: 'all',
  };
  axiosMock.get.mockResolvedValueOnce(response(data));

  await expect(getUsernameChanges(2, 'all')).resolves.toBe(data);
  expect(axiosMock.get).toHaveBeenCalledWith('/api/admin/username-changes', {
    params: { page: 2, range: 'all' },
  });
});

it('defaults to the previous 90 days', async () => {
  const data: AdminUsernameChangesPage = {
    changes: [],
    page: 1,
    hasNextPage: false,
    range: '90d',
  };
  axiosMock.get.mockResolvedValueOnce(response(data));

  await expect(getUsernameChanges(1)).resolves.toBe(data);
  expect(axiosMock.get).toHaveBeenCalledWith('/api/admin/username-changes', {
    params: { page: 1, range: '90d' },
  });
});
