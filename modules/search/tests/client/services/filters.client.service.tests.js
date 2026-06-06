import '@/modules/search/client/search.client.module';
import AppConfig from '@/modules/core/client/app/config';

describe('FiltersService', function () {
  function loadService(options = {}) {
    let FiltersService;
    let $log;
    const Authentication = {
      user: options.user || null,
    };
    const locker = {
      get: jasmine
        .createSpy('locker.get')
        .and.callFake(function (_cachePrefix, fallback) {
          return angular.copy(
            Object.prototype.hasOwnProperty.call(options, 'cachedFilters')
              ? options.cachedFilters
              : fallback,
          );
        }),
      put: jasmine.createSpy('locker.put'),
      supported: jasmine
        .createSpy('locker.supported')
        .and.returnValue(options.supported !== false),
    };

    angular.mock.module(AppConfig.appModuleName, function ($provide) {
      $provide.value('Authentication', Authentication);
      $provide.value('locker', locker);
    });

    inject(function (_FiltersService_, _$log_) {
      FiltersService = _FiltersService_;
      $log = _$log_;
      spyOn($log, 'warn').and.callThrough();
    });

    return {
      $log,
      FiltersService,
      locker,
    };
  }

  it('loads cached filters with missing keys filled from defaults', function () {
    const { FiltersService, locker } = loadService({
      cachedFilters: {
        tribes: ['cyclists'],
        types: ['host'],
      },
      user: {
        _id: 'user-1',
      },
    });

    expect(locker.get).toHaveBeenCalledWith(
      'search.filters.user-1',
      jasmine.any(Object),
    );
    expect(FiltersService.get()).toEqual({
      languages: [],
      seen: {
        months: 6,
      },
      tribes: ['cyclists'],
      types: ['host'],
    });
  });

  it('persists filter changes to the authenticated user cache', function () {
    const { FiltersService, locker } = loadService({
      user: {
        _id: 'user-2',
      },
    });

    FiltersService.set('languages', ['en', 'pt']);

    expect(FiltersService.get('languages')).toEqual(['en', 'pt']);
    expect(locker.put).toHaveBeenCalledWith(
      'search.filters.user-2',
      FiltersService.get(),
    );
  });

  it('uses uncached defaults when local storage is unavailable', function () {
    const { FiltersService, locker } = loadService({
      supported: false,
    });

    FiltersService.set('types', ['meet']);

    expect(locker.get).not.toHaveBeenCalled();
    expect(locker.put).not.toHaveBeenCalled();
    expect(FiltersService.get()).toEqual({
      languages: [],
      seen: {
        months: 6,
      },
      tribes: [],
      types: ['meet'],
    });
  });

  it('warns and returns undefined for unknown filters', function () {
    const { $log, FiltersService } = loadService();

    expect(FiltersService.get('unknown-filter')).toBeUndefined();
    expect($log.warn).toHaveBeenCalledWith('Requested filter does not exist.');
  });
});
