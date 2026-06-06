import AppConfig from '@/modules/core/client/app/config';
import '@/modules/core/client/services/settings.client.service';

describe('settings services', function () {
  let $window;
  let SettingsFactory;
  let SettingsService;

  beforeEach(angular.mock.module(AppConfig.appModuleName));

  beforeEach(inject(function (_$window_, _SettingsFactory_, _SettingsService_) {
    $window = _$window_;
    SettingsFactory = _SettingsFactory_;
    SettingsService = _SettingsService_;
  }));

  it('returns backend-provided settings unchanged from SettingsService', function () {
    $window.settings = {
      apiUrl: 'https://api.example.test',
      flashTimeout: 1000,
    };

    const settings = SettingsService.get();

    expect(settings).toEqual({
      apiUrl: 'https://api.example.test',
      flashTimeout: 1000,
    });
    expect(settings).toBe($window.settings);
  });

  it('adds deprecated defaults from SettingsFactory', function () {
    $window.settings = {
      apiUrl: 'https://api.example.test',
    };

    const settings = SettingsFactory.get();

    expect(settings).toEqual({
      apiUrl: 'https://api.example.test',
      flashTimeout: 6000,
    });
    expect(settings).toBe($window.settings);
  });

  it('overwrites flash timeout with the deprecated default', function () {
    $window.settings = {
      flashTimeout: 250,
    };

    expect(SettingsFactory.get().flashTimeout).toBe(6000);
  });
});
