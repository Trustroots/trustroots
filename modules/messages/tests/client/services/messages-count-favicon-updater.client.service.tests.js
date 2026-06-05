import { ready } from '@/modules/core/client/utils/dom';
import { watch } from '@/modules/messages/client/services/unread-message-count.client.service';
import { enable } from '@/modules/messages/client/services/messages-count-favicon-updater.client.service';
import '@testing-library/jest-dom/extend-expect';

jest.mock('@/modules/core/client/utils/dom', () => ({
  ready: jest.fn(),
}));

jest.mock(
  '@/modules/messages/client/services/unread-message-count.client.service',
  () => ({
    watch: jest.fn(),
  }),
);

describe('messages count favicon updater', () => {
  let unreadCountWatcher;

  beforeEach(() => {
    document.head.innerHTML = `
      <link id="favicon" href="/img/favicon.png">
      <link id="favicon2x" href="/img/favicon@2x.png">
    `;
    ready.mockImplementation(callback => callback());
    watch.mockImplementation(callback => {
      unreadCountWatcher = callback;
    });
  });

  afterEach(() => {
    document.head.innerHTML = '';
    jest.clearAllMocks();
  });

  it('starts watching unread counts when the DOM is ready', () => {
    enable();

    expect(ready).toHaveBeenCalledWith(expect.any(Function));
    expect(watch).toHaveBeenCalledWith(expect.any(Function));
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
