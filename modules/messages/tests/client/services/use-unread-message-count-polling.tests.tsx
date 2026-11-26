import { renderHook } from '@testing-library/react';

import useUnreadMessageCountPolling from '@/modules/messages/client/services/use-unread-message-count-polling';
import { start } from '@/modules/messages/client/services/unread-message-count.client.service';
import { setViewer } from '@/testutils/client/auth.testutil';

vi.mock('@trustroots/core/auth', async () =>
  (await import('@/testutils/client/auth.testutil')).mockAuthModule(),
);
vi.mock(
  '@/modules/messages/client/services/unread-message-count.client.service',
);

const mockStart = vi.mocked(start);
const stop = vi.fn();
const publicMember = { _id: 'fictional-member', public: true };

beforeEach(() => {
  mockStart.mockReset().mockReturnValue(stop);
  stop.mockReset();
});

describe('useUnreadMessageCountPolling', () => {
  it('polls while a public member is signed in', () => {
    setViewer(publicMember);
    const { unmount } = renderHook(() => useUnreadMessageCountPolling());
    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(stop).not.toHaveBeenCalled();

    unmount();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('does not poll for anonymous or non-public members', () => {
    setViewer(null);
    const { rerender } = renderHook(() => useUnreadMessageCountPolling());
    setViewer({ _id: 'fictional-member', public: false });
    rerender();
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('starts on sign-in and stops on sign-out', () => {
    setViewer(null);
    const { rerender } = renderHook(() => useUnreadMessageCountPolling());
    setViewer(publicMember);
    rerender();
    expect(mockStart).toHaveBeenCalledTimes(1);

    setViewer({ ...publicMember });
    rerender();
    expect(mockStart).toHaveBeenCalledTimes(1);

    setViewer(null);
    rerender();
    expect(stop).toHaveBeenCalledTimes(1);
  });
});
