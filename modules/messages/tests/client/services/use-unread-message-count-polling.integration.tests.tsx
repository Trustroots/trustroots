import { act, renderHook } from '@testing-library/react';

import { unreadCount } from '@/modules/messages/client/api/messages.api';
import { watch } from '@/modules/messages/client/services/unread-message-count.client.service';
import useUnreadMessageCountPolling from '@/modules/messages/client/services/use-unread-message-count-polling';
import {
  disable,
  enable,
} from '@/modules/messages/client/services/visibility.client.service';
import { setViewer } from '@/testutils/client/auth.testutil';

vi.mock('@/modules/core/client/react-app/auth', async () =>
  (await import('@/testutils/client/auth.testutil')).mockAuthModule(),
);
vi.mock('@/modules/messages/client/api/messages.api');

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  enable();
});

afterEach(() => {
  disable();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it('immediately polls the new public member when the signed-in account changes', async () => {
  vi.mocked(unreadCount).mockResolvedValueOnce(4).mockResolvedValueOnce(1);
  const onCount = vi.fn();
  const unwatch = watch(onCount);
  setViewer({ _id: 'fictional-member-a', public: true });
  const { rerender, unmount } = renderHook(() =>
    useUnreadMessageCountPolling(),
  );

  await act(async () => {
    await Promise.resolve();
  });
  expect(unreadCount).toHaveBeenCalledTimes(1);
  expect(onCount).toHaveBeenLastCalledWith(4);

  setViewer({ _id: 'fictional-member-b', public: true });
  rerender();
  expect(unreadCount).toHaveBeenCalledTimes(2);
  await act(async () => {
    await Promise.resolve();
  });
  expect(onCount).toHaveBeenLastCalledWith(1);

  unmount();
  unwatch();
});
