import axios from 'axios';
import { getMembersWhoBlockedMe } from '@/modules/admin/client/api/blocked-by-me.api';

jest.mock('axios', () =>
  jest.requireActual('@/modules/core/tests/client/api/axios.mock.js'),
);

it('gets members who blocked the signed-in staff account', async () => {
  const data = [{ _id: 'member-1', username: 'member' }];
  axios.get.mockResolvedValueOnce({ data });

  await expect(getMembersWhoBlockedMe()).resolves.toBe(data);
  expect(axios.get).toHaveBeenCalledWith('/api/admin/blocked-by-me');
});
