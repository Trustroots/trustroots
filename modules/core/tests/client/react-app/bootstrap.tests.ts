import { getBootstrapData } from '@/modules/core/client/react-app/bootstrap';

describe('React app bootstrap data', () => {
  const bootstrapKeys = [
    'env',
    'gaId',
    'isNativeMobileApp',
    'settings',
    'title',
    'user',
  ] as const;
  type BootstrapKey = typeof bootstrapKeys[number];
  const originalWindowValues = new Map<BootstrapKey, unknown>();

  beforeEach(() => {
    bootstrapKeys.forEach(key => {
      originalWindowValues.set(key, window[key]);
      delete window[key];
    });
  });

  afterEach(() => {
    Object.assign(
      window,
      Object.fromEntries(
        bootstrapKeys.map(key => [key, originalWindowValues.get(key)]),
      ),
    );
  });

  it('returns defaults when the server globals are absent', () => {
    expect(getBootstrapData()).toEqual({
      env: 'production',
      gaId: undefined,
      isNativeMobileApp: false,
      settings: {
        flashTimeout: 6000,
      },
      title: 'Trustroots',
      user: null,
    });
  });

  it('wraps server globals and preserves custom settings', () => {
    window.env = 'test';
    window.gaId = 'ga-id';
    window.isNativeMobileApp = true;
    window.settings = {
      commit: 'abc123',
      flashTimeout: 3000,
    };
    window.title = 'Custom title';
    window.user = {
      username: 'alice',
    };

    expect(getBootstrapData()).toEqual({
      env: 'test',
      gaId: 'ga-id',
      isNativeMobileApp: true,
      settings: {
        commit: 'abc123',
        flashTimeout: 3000,
      },
      title: 'Custom title',
      user: {
        username: 'alice',
      },
    });
  });
});
