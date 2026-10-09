import axios, { type AxiosResponse } from 'axios';
import { getStaffBlockers } from '@/modules/admin/client/api/staff-blockers.api';
import type { StaffBlocker } from '@/modules/admin/shared/staff-blockers';

jest.mock('axios', () =>
  jest.requireActual('@/modules/core/tests/client/api/axios.mock.js'),
);

const axiosMock = jest.mocked(axios);
const AxiosHeaders =
  jest.requireActual<typeof import('axios')>('axios').AxiosHeaders;

function response<T>(data: T): AxiosResponse<T> {
  const headers = new AxiosHeaders();
  return { data, status: 200, statusText: 'OK', headers, config: { headers } };
}

it('gets the staff blocker list allowed for the current user', async () => {
  const data: StaffBlocker[] = [
    { _id: 'staff-1', username: 'staff', blockedBy: [] },
  ];
  axiosMock.get.mockResolvedValueOnce(response(data));

  await expect(getStaffBlockers()).resolves.toBe(data);
  expect(axiosMock.get).toHaveBeenCalledWith('/api/admin/staff-blockers');
});
