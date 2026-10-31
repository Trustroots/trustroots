import axios from 'axios';
import {
  getSparkpostOverview,
  getSparkpostEvents,
  getSparkpostPreview,
} from '@/modules/admin/client/api/sparkpost.api';
jest.mock('axios', () =>
  jest.requireActual('@/modules/core/tests/client/api/axios.mock'),
);
afterEach(() => jest.clearAllMocks());
it('fetches read-only diagnostics with bounded request options', async () => {
  jest.mocked(axios.get).mockResolvedValue({ data: { fixture: true } });
  await expect(getSparkpostOverview('7')).resolves.toEqual({ fixture: true });
  expect(axios.get).toHaveBeenLastCalledWith('/api/admin/sparkpost/overview', {
    params: { days: '7' },
  });
  await getSparkpostEvents('2026-10-30');
  expect(axios.get).toHaveBeenLastCalledWith('/api/admin/sparkpost/events', {
    params: { date: '2026-10-30' },
    timeout: 60000,
  });
  await getSparkpostPreview('start', 'end');
  expect(axios.get).toHaveBeenLastCalledWith('/api/admin/sparkpost/preview', {
    params: { from: 'start', to: 'end' },
  });
});
