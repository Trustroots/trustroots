import axios from 'axios';

import { getAuditLog } from '@/modules/admin/client/api/audit-log.api';

jest.mock('axios');

afterEach(() => {
  jest.clearAllMocks();
});

describe('admin audit-log api', () => {
  it('fetches the audit log', async () => {
    const data = [{ _id: 'entry-1' }];
    axios.get.mockResolvedValueOnce({ data });

    await expect(getAuditLog()).resolves.toBe(data);
    expect(axios.get).toHaveBeenCalledWith('/api/admin/audit-log');
  });
});
