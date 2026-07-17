import { getBootstrapData } from '@/modules/core/client/react-app/bootstrap';

describe('React app bootstrap data', () => {
  const originalWindowValues = {};

  beforeEach(() => {
    [
      'env',
      'facebookAppId',
      'gaId',
      'isNativeMobileApp',
      'settings',
      'title',
      'user',
    ].forEach(key => {
      originalWindowValues[key] = window[key];
      delete window[key];
    });
  });

  afterEach(() => {
    Object.keys(originalWindowValues).forEach(key => {
      window[key] = originalWindowValues[key];
    });
  });

  it('returns defaults when the server globals are absent', () => {
    expect(getBootstrapData()).toEqual({
      env: 'production',
      facebookAppId: undefined,
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
    window.facebookAppId = 'facebook-app';
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
      facebookAppId: 'facebook-app',
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
