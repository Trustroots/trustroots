import axios from '@/modules/core/client/api/http-client.js';
import { getGravatarUsage } from '@/modules/admin/client/api/gravatar.api';
jest.mock('@/modules/core/client/api/http-client.js');
it('requests the selected page of Gravatar members', async () => {
  const data = {
    accounts: 0,
    members: [],
    page: 2,
    hasNextPage: false,
    measuredAt: '2026-11-06T12:00:00Z',
  };
  jest.mocked(axios.get).mockResolvedValue({ data });
  await expect(getGravatarUsage(2)).resolves.toEqual(data);
  expect(axios.get).toHaveBeenCalledWith('/api/admin/gravatar', {
    params: { page: 2 },
  });
  await expect(
    getGravatarUsage(2, { column: 'seen', direction: 'descending' }),
  ).resolves.toEqual(data);
  expect(axios.get).toHaveBeenLastCalledWith('/api/admin/gravatar', {
    params: { page: 2, sort: 'seen', direction: 'descending' },
  });
});
