import '@testing-library/jest-dom/extend-expect';

import * as visibilityService from '@/modules/messages/client/services/visibility.client.service';

describe('visibility service', () => {
  let originalHiddenDescriptor;
  let originalMsHiddenDescriptor;
  let originalWebkitHiddenDescriptor;

  beforeEach(() => {
    originalHiddenDescriptor = Object.getOwnPropertyDescriptor(
      document,
      'hidden',
    );
    originalMsHiddenDescriptor = Object.getOwnPropertyDescriptor(
      document,
      'msHidden',
    );
    originalWebkitHiddenDescriptor = Object.getOwnPropertyDescriptor(
      document,
      'webkitHidden',
    );
    visibilityService.disable();
  });

  afterEach(() => {
    restoreProperty('hidden', originalHiddenDescriptor);
    restoreProperty('msHidden', originalMsHiddenDescriptor);
    restoreProperty('webkitHidden', originalWebkitHiddenDescriptor);
    jest.restoreAllMocks();
  });

  it('subscribes to visibilitychange and notifies watchers on updates', async () => {
    defineDocumentProperty('hidden', false);
    const addListener = jest.spyOn(document, 'addEventListener');
    const removeListener = jest.spyOn(document, 'removeEventListener');
    const watcher = jest.fn();

    visibilityService.enable();
    visibilityService.watch(watcher);
    document.dispatchEvent(new Event('visibilitychange'));

    expect(watcher).toHaveBeenCalledWith(true);
    expect(addListener).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
      false,
    );

    defineDocumentProperty('hidden', true);
    document.dispatchEvent(new Event('visibilitychange'));

    expect(watcher).toHaveBeenLastCalledWith(false);
    visibilityService.disable();
    expect(removeListener).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
    );
  });

  it('is idempotent for repeated enable calls', () => {
    defineDocumentProperty('hidden', false);
    const addListener = jest.spyOn(document, 'addEventListener');

    visibilityService.enable();
    visibilityService.enable();

    expect(addListener).toHaveBeenCalledTimes(1);
  });

  it('does not register browser listeners when visibility API is unavailable', () => {
    defineDocumentProperty('hidden', undefined);
    defineDocumentProperty('msHidden', undefined);
    defineDocumentProperty('webkitHidden', undefined);

    const addListener = jest.spyOn(document, 'addEventListener');
    const watcher = jest.fn();

    visibilityService.enable();
    visibilityService.watch(watcher);

    expect(addListener).not.toHaveBeenCalled();
    expect(watcher).toHaveBeenCalledWith(true);
  });
});

function defineDocumentProperty(name, value) {
  Object.defineProperty(document, name, {
    configurable: true,
    writable: true,
    value,
  });
}

function restoreProperty(name, descriptor) {
  if (!descriptor) {
    // eslint-disable-next-line no-param-reassign
    delete document[name];
    return;
  }

  Object.defineProperty(document, name, descriptor);
}
