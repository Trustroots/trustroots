import axios from 'axios';

import {
  getAuditLog,
  getAuditLogActors,
} from '@/modules/admin/client/api/audit-log.api';

jest.mock('axios', () =>
  jest.requireActual('@/modules/core/tests/client/api/axios.mock.js'),
);

afterEach(() => {
  jest.clearAllMocks();
});

describe('admin audit-log api', () => {
  it('sends actor and team filters as query parameters', async () => {
    axios.get.mockResolvedValueOnce({ data: [] });
    const filters = { username: 'river', team: 'welcome-team' };
    await expect(getAuditLog(filters)).resolves.toEqual([]);
    expect(axios.get).toHaveBeenCalledWith('/api/admin/audit-log', {
      params: filters,
    });
  });

  it('loads all historical actor options', async () => {
    axios.get.mockResolvedValueOnce({ data: [{ username: 'river' }] });
    await expect(getAuditLogActors()).resolves.toEqual([{ username: 'river' }]);
    expect(axios.get).toHaveBeenCalledWith('/api/admin/audit-log/actors');
  });
  it('fetches the audit log', async () => {
    const data = [{ _id: 'entry-1' }];
    axios.get.mockResolvedValueOnce({ data });

    await expect(getAuditLog()).resolves.toBe(data);
    expect(axios.get).toHaveBeenCalledWith('/api/admin/audit-log');
  });
});
