import { ready } from '@/modules/core/client/utils/dom';
import { watch } from '@/modules/messages/client/services/unread-message-count.client.service';
import { enable } from '@/modules/messages/client/services/messages-count-favicon-updater.client.service';

vi.mock('@/modules/core/client/utils/dom', () => ({
  ready: vi.fn(),
}));

vi.mock(
  '@/modules/messages/client/services/unread-message-count.client.service',
  () => ({
    watch: vi.fn(),
  }),
);

const readyMock = vi.mocked(ready);
const watchMock = vi.mocked(watch);
let unreadCountWatcher!: (count: number) => void;

describe('messages count favicon updater', () => {
  beforeEach(() => {
    document.head.innerHTML = `
      <link id="favicon" href="/img/favicon.png">
      <link id="favicon2x" href="/img/favicon@2x.png">
    `;
    readyMock.mockImplementation(callback => callback?.());
    watchMock.mockImplementation(callback => {
      unreadCountWatcher = callback;
      return () => {};
    });
  });

  afterEach(() => {
    document.head.innerHTML = '';
    vi.clearAllMocks();
  });

  it('starts watching unread counts when the DOM is ready', () => {
    enable();

    expect(readyMock).toHaveBeenCalledWith(expect.any(Function));
    expect(watchMock).toHaveBeenCalledWith(expect.any(Function));
  });

  it('switches favicons when unread messages appear and disappear', () => {
    enable();

    unreadCountWatcher(2);

    expect(document.getElementById('favicon')).toHaveAttribute(
      'href',
      '/img/favicon-notification.png',
    );
    expect(document.getElementById('favicon2x')).toHaveAttribute(
      'href',
      '/img/favicon-notification@2x.png',
    );

    unreadCountWatcher(0);

    expect(document.getElementById('favicon')).toHaveAttribute(
      'href',
      '/img/favicon.png',
    );
    expect(document.getElementById('favicon2x')).toHaveAttribute(
      'href',
      '/img/favicon@2x.png',
    );
  });
});
