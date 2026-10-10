import http from '../../../../core/client/api/http-client';
import { load, setStatus } from '../../../client/api/support.api';
jest.mock('../../../../core/client/api/http-client', () => ({
  get: jest.fn(),
  patch: jest.fn(),
}));
test('loads support information and updates request status', async () => {
  jest.mocked(http.get).mockResolvedValue({ data: { items: [] } });
  expect(await load('/api/admin/support')).toEqual({ items: [] });
  expect(http.get).toHaveBeenCalledWith('/api/admin/support');
  await setStatus('report/1', 'resolved');
  expect(http.patch).toHaveBeenCalledWith('/api/admin/support/report%2F1', {
    status: 'resolved',
  });
});
