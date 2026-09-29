import axios from 'axios';
import { getStaffBlockers } from '@/modules/admin/client/api/staff-blockers.api';

jest.mock('axios', () =>
  jest.requireActual('@/modules/core/tests/client/api/axios.mock.js'),
);

it('gets the staff blocker list allowed for the current user', async () => {
  const data = [{ _id: 'staff-1', username: 'staff', blockedBy: [] }];
  axios.get.mockResolvedValueOnce({ data });

  await expect(getStaffBlockers()).resolves.toBe(data);
  expect(axios.get).toHaveBeenCalledWith('/api/admin/staff-blockers');
});
