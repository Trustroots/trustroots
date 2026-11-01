import axios from 'axios';
import {
  getSparkpostOverview,
  getSparkpostEvents,
  getSparkpostPreview,
  getRecoveryDay,
  getRecoveryAccounts,
  sendRecovery,
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

it('fetches cursor pages and account lists, and posts only selected recovery IDs', async () => {
  jest.mocked(axios.get).mockResolvedValue({ data: { candidates: [] } });
  jest.mocked(axios.post).mockResolvedValue({ data: { results: [] } });
  await getSparkpostEvents('2026-10-30', 'next');
  expect(axios.get).toHaveBeenLastCalledWith('/api/admin/sparkpost/events', {
    params: { date: '2026-10-30', cursor: 'next' },
    timeout: 60000,
  });
  await getRecoveryDay('2026-10-30');
  expect(axios.get).toHaveBeenLastCalledWith('/api/admin/sparkpost/recovery', {
    params: { date: '2026-10-30', page: 1 },
  });
  await getRecoveryAccounts('from', 'to', 2);
  expect(axios.get).toHaveBeenLastCalledWith('/api/admin/sparkpost/accounts', {
    params: { from: 'from', to: 'to', page: 2 },
  });
  await sendRecovery('2026-10-30', ['signup:sample']);
  expect(axios.post).toHaveBeenLastCalledWith('/api/admin/sparkpost/recovery', {
    date: '2026-10-30',
    keys: ['signup:sample'],
  });
});
