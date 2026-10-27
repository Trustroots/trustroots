import axios, { type AxiosResponse } from 'axios';
import {
  getMemberNetworkConnections,
  searchNetworkConnections,
} from '@/modules/admin/client/api/network-connections.api';

jest.mock('axios', () =>
  jest.requireActual('@/modules/core/tests/client/api/axios.mock'),
);

const axiosMock = jest.mocked(axios);

function response<T>(data: T): AxiosResponse<T> {
  const { AxiosHeaders: ActualAxiosHeaders } =
    jest.requireActual<typeof import('axios')>('axios');
  const headers = new ActualAxiosHeaders();
  return { data, status: 200, statusText: 'OK', headers, config: { headers } };
}

afterEach(() => jest.clearAllMocks());

test('loads a member connection history page', async () => {
  const data = { current: [], history: [], page: 2, hasNextPage: true };
  axiosMock.get.mockResolvedValueOnce(response(data));
  await expect(getMemberNetworkConnections('member/id')).resolves.toBe(data);
  expect(axiosMock.get).toHaveBeenCalledWith(
    '/api/admin/network-connections/member%2Fid',
    { params: { page: 1 } },
  );
});

test('searches connection history by network and identifier', async () => {
  const data = { members: [], page: 1, hasNextPage: false };
  axiosMock.get.mockResolvedValueOnce(response(data));
  await expect(searchNetworkConnections('nostr', 'npub-example')).resolves.toBe(
    data,
  );
  expect(axiosMock.get).toHaveBeenCalledWith('/api/admin/network-connections', {
    params: { network: 'nostr', identifier: 'npub-example', page: 1 },
  });
});
