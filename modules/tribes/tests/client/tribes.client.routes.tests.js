import '@/modules/tribes/client/tribes.client.module';
import AppConfig from '@/modules/core/client/app/config';

describe('Tribes Route Tests', function () {
  beforeEach(angular.mock.module(AppConfig.appModuleName));

  beforeEach(
    angular.mock.module(function ($urlRouterProvider) {
      $urlRouterProvider.deferIntercept();
    }),
  );

  describe('Route Config', function () {
    let mainstate;

    it('configures root circles route', inject(function ($state) {
      mainstate = $state.get('circles');

      expect(mainstate.url).toEqual('/circles');
      expect(mainstate.abstract).toBe(true);
      expect(mainstate.template).toBe('<ui-view/>');
    }));

    it('configures circles list route', inject(function ($state) {
      mainstate = $state.get('circles.list');

      expect(mainstate.url).toEqual('');
      expect(mainstate.abstract).toBeUndefined();
      expect(mainstate.template).toContain('tribes-page');
      expect(mainstate.templateUrl).toBeUndefined();
      expect(mainstate.controller).toBe('TribesListController');
      expect(mainstate.controllerAs).toBe('tribesList');
    }));

    it('loads circle data by slug from TribeService', inject(function (
      $state,
      $injector,
    ) {
      const state = $state.get('circles.circle');
      const TribeService = {
        get: jest.fn().mockReturnValue('circle-response'),
      };

      expect(
        $injector.invoke(state.resolve.tribe, null, {
          TribeService,
          $stateParams: {
            circle: 'travel',
          },
        }),
      ).toBe('circle-response');
      expect(TribeService.get).toHaveBeenCalledWith({
        tribeSlug: 'travel',
      });
    }));
  });
});
