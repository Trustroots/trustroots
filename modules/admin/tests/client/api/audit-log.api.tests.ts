import axios, { type AxiosResponse } from 'axios';

import {
  getAuditLog,
  getAuditLogActors,
  type AdminAuditLogEntry,
  type AuditActor,
  type AuditLogFilters,
} from '@/modules/admin/client/api/audit-log.api';

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

describe('admin audit-log api', () => {
  it('sends actor and team filters as query parameters', async () => {
    axiosMock.get.mockResolvedValueOnce(response<AdminAuditLogEntry[]>([]));
    const filters: AuditLogFilters = {
      username: 'sample-actor',
      team: 'welcome-team',
    };
    await expect(getAuditLog(filters)).resolves.toEqual([]);
    expect(axiosMock.get).toHaveBeenCalledWith('/api/admin/audit-log', {
      params: filters,
    });
  });

  it('loads all historical actor options', async () => {
    const actors: AuditActor[] = [
      {
        _id: 'actor-1',
        username: 'sample-actor',
        displayName: 'Sample Actor',
        roles: ['admin'],
      },
    ];
    axiosMock.get.mockResolvedValueOnce(response(actors));
    await expect(getAuditLogActors()).resolves.toEqual(actors);
    expect(axiosMock.get).toHaveBeenCalledWith('/api/admin/audit-log/actors');
  });
  it('fetches the audit log', async () => {
    const data: AdminAuditLogEntry[] = [{ _id: 'entry-1' }];
    axiosMock.get.mockResolvedValueOnce(response(data));

    await expect(getAuditLog()).resolves.toBe(data);
    expect(axiosMock.get).toHaveBeenCalledWith('/api/admin/audit-log');
  });
});
