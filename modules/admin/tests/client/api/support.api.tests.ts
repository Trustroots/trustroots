import http from '../../../../core/client/api/http-client';
import {
  listRequests,
  load,
  loadConversation,
  retryReply,
  sendReply,
  setStatus,
} from '../../../client/api/support.api';
jest.mock('../../../../core/client/api/http-client', () => ({
  get: jest.fn(),
  patch: jest.fn(),
  post: jest.fn(),
}));
test('loads support information and updates request status', async () => {
  jest.mocked(http.get).mockResolvedValue({ data: { items: [] } });
  expect(await load('/api/admin/support')).toEqual({ items: [] });
  expect(http.get).toHaveBeenCalledWith('/api/admin/support');
  await setStatus('report/1', 'solved');
  expect(http.patch).toHaveBeenCalledWith('/api/admin/support/report%2F1', {
    status: 'solved',
  });
});

test('serialises inbox filters and reads request conversations', async () => {
  jest.mocked(http.get).mockResolvedValue({ data: { items: [], page: 2 } });
  await listRequests({
    status: 'unresolved',
    category: 'reportMember',
    page: 2,
    q: 'literal name',
  });
  expect(http.get).toHaveBeenCalledWith(
    '/api/admin/support?status=unresolved&page=2&category=reportMember&q=literal+name',
  );
  await loadConversation('request/1', 3);
  expect(http.get).toHaveBeenLastCalledWith(
    '/api/admin/support/request%2F1/conversation?page=3',
  );
  await listRequests({ status: 'unresolved', page: 1 });
  expect(http.get).toHaveBeenLastCalledWith(
    '/api/admin/support?status=unresolved&page=1',
  );
});

test('queues replies and retries uncertain delivery explicitly', async () => {
  jest.mocked(http.post).mockResolvedValue({ data: { _id: 'reply-1' } });
  await sendReply('request/1', 'A plain text reply', 'key-1');
  expect(http.post).toHaveBeenNthCalledWith(
    1,
    '/api/admin/support/request%2F1/replies',
    { body: 'A plain text reply', idempotencyKey: 'key-1' },
  );
  await retryReply('request/1', 'reply/1', 'key-2', true);
  expect(http.post).toHaveBeenNthCalledWith(
    2,
    '/api/admin/support/request%2F1/replies/reply%2F1/retry',
    { idempotencyKey: 'key-2', confirmUncertain: true },
  );
  await retryReply('request/1', 'reply/1', 'key-3');
  expect(http.post).toHaveBeenLastCalledWith(
    '/api/admin/support/request%2F1/replies/reply%2F1/retry',
    { idempotencyKey: 'key-3' },
  );
});
