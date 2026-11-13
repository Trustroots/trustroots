import axios from '@/modules/core/client/api/http-client.js';
import {
  getGravatarPhotoCheck,
  getGravatarUsage,
  startGravatarPhotoCheck,
} from '@/modules/admin/client/api/gravatar.api';
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

it('reads and starts the Gravatar photo check', async () => {
  const url = '/api/admin/gravatar/photo-check';
  const data = {
    state: 'running',
    startedAt: '2026-11-06T12:00:00Z',
    counts: { available: 0, unavailable: 0, inconclusive: 0 },
  };
  jest.mocked(axios.get).mockResolvedValue({ data: null });
  jest.mocked(axios.post).mockResolvedValue({ data });
  await expect(getGravatarPhotoCheck()).resolves.toBeNull();
  expect(axios.get).toHaveBeenLastCalledWith(url);
  await expect(startGravatarPhotoCheck()).resolves.toEqual(data);
  expect(axios.post).toHaveBeenLastCalledWith(url);
});
