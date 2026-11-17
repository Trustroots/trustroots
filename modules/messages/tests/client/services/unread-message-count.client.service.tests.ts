import * as messagesAPI from '@/modules/messages/client/api/messages.api';

vi.mock('@/modules/messages/client/api/messages.api');

type UnreadMessageCountService =
  typeof import('@/modules/messages/client/services/unread-message-count.client.service');
type VisibilityService =
  typeof import('@/modules/messages/client/services/visibility.client.service');
type VisibilityProperty = 'hidden' | 'msHidden' | 'webkitHidden';
let unreadMessageCountService!: UnreadMessageCountService;
let enableVisibilityWatching!: VisibilityService['enable'];
let disableVisibilityWatching!: VisibilityService['disable'];
const originalHiddenDescriptor = Object.getOwnPropertyDescriptor(
  document,
  'hidden',
);

beforeEach(async () => {
  defineDocumentProperty('hidden', false);

  vi.resetModules();
  const visibilityService =
    await import('@/modules/messages/client/services/visibility.client.service');
  ({ enable: enableVisibilityWatching, disable: disableVisibilityWatching } =
    visibilityService);
  enableVisibilityWatching();
  unreadMessageCountService =
    await import('@/modules/messages/client/services/unread-message-count.client.service');
});

let stopPolling: (() => void) | undefined;

afterEach(() => {
  stopPolling?.();
  stopPolling = undefined;
  disableVisibilityWatching();
  restoreProperty('hidden', originalHiddenDescriptor);
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

const api = {
  messages: vi.mocked(messagesAPI),
};

describe('Unread Message Count Service', () => {
  let unreadCount: number;

  beforeEach(() => {
    unreadCount = 42;
  });

  it('gives value immediately when polling starts', async () => {
    api.messages.unreadCount.mockResolvedValue(unreadCount);
    await new Promise<void>(done => {
      unreadMessageCountService.watch(count => {
        expect(count).toBe(unreadCount);
        done();
      });
      stopPolling = unreadMessageCountService.start();
    });
  });

  it('does not poll before polling starts', () => {
    api.messages.unreadCount.mockResolvedValue(unreadCount);

    unreadMessageCountService.watch(vi.fn());

    expect(api.messages.unreadCount).not.toHaveBeenCalled();
  });

  it('stops polling when stopped', () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
    api.messages.unreadCount.mockResolvedValue(unreadCount);
    const stop = unreadMessageCountService.start();
    expect(api.messages.unreadCount).toHaveBeenCalledTimes(1);

    stop();

    expect(clearIntervalSpy).toHaveBeenCalled();
    defineDocumentProperty('hidden', true);
    document.dispatchEvent(new Event('visibilitychange'));
    defineDocumentProperty('hidden', false);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(api.messages.unreadCount).toHaveBeenCalledTimes(1);
  });

  it('does nothing when stopped twice', () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
    api.messages.unreadCount.mockResolvedValue(unreadCount);
    const stop = unreadMessageCountService.start();
    stop();
    clearIntervalSpy.mockClear();

    stop();

    expect(clearIntervalSpy).not.toHaveBeenCalled();
  });

  it('does not notify subscribers when unread count is unchanged', async () => {
    api.messages.unreadCount
      .mockResolvedValueOnce(unreadCount)
      .mockResolvedValueOnce(unreadCount);

    const watcher = vi.fn<(...args: [count: number]) => void>();
    unreadMessageCountService.watch(watcher);

    await unreadMessageCountService.update();
    await unreadMessageCountService.update();

    expect(watcher).toHaveBeenCalledTimes(1);
    expect(watcher).toHaveBeenCalledWith(unreadCount);
  });

  it('sets a background polling interval when document is hidden', () => {
    const setIntervalSpy = vi.spyOn(global, 'setInterval');
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
    disableVisibilityWatching();
    defineDocumentProperty('hidden', true);
    enableVisibilityWatching();
    api.messages.unreadCount.mockResolvedValue(unreadCount);

    stopPolling = unreadMessageCountService.start();

    expect(api.messages.unreadCount).not.toHaveBeenCalled();
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 300000);
    expect(clearIntervalSpy).not.toHaveBeenCalled();
  });

  it('polls in the foreground every 30 seconds', () => {
    const setIntervalSpy = vi.spyOn(global, 'setInterval');
    api.messages.unreadCount.mockResolvedValue(unreadCount);

    stopPolling = unreadMessageCountService.start();

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 30000);
  });

  it('restarts polling when started again', () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
    api.messages.unreadCount.mockResolvedValue(unreadCount);

    unreadMessageCountService.start();
    stopPolling = unreadMessageCountService.start();

    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    expect(api.messages.unreadCount).toHaveBeenCalledTimes(2);
  });

  it('swallows a failed poll and keeps polling', async () => {
    vi.useFakeTimers();
    api.messages.unreadCount
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('signed out'))
      .mockResolvedValue(unreadCount);
    const watcher = vi.fn();
    unreadMessageCountService.watch(watcher);

    stopPolling = unreadMessageCountService.start();
    await vi.advanceTimersByTimeAsync(30000);
    expect(watcher).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(30000);

    expect(api.messages.unreadCount).toHaveBeenCalledTimes(3);
    expect(watcher).toHaveBeenCalledWith(unreadCount);
    vi.useRealTimers();
  });

  it('delivers cached unread count to late subscribers', async () => {
    api.messages.unreadCount.mockResolvedValue(unreadCount);
    await unreadMessageCountService.update();

    const watcher = vi.fn();
    unreadMessageCountService.watch(watcher);

    expect(watcher).toHaveBeenCalledWith(unreadCount);
  });
});

function defineDocumentProperty(
  name: VisibilityProperty,
  value: boolean | undefined,
): void {
  Object.defineProperty(document, name, {
    configurable: true,
    writable: true,
    value,
  });
}

function restoreProperty(
  name: VisibilityProperty,
  descriptor: PropertyDescriptor | undefined,
): void {
  if (!descriptor) {
    Reflect.deleteProperty(document, name);
    return;
  }

  Object.defineProperty(document, name, descriptor);
}
