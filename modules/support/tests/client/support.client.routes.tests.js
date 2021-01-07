import '@/modules/support/client/support.client.module';
import AppConfig from '@/modules/core/client/app/config';

describe('Support Route Tests', function () {
  // We can start by loading the main application module
  beforeEach(angular.mock.module(AppConfig.appModuleName));

  describe('Route Config', function () {
    describe('Main Route (support)', function () {
      let mainstate;
      beforeEach(inject(function ($state) {
        mainstate = $state.get('support');
      }));

      it('Should have the correct URL', function () {
        expect(mainstate.url).toEqual('/support?report=');
      });

      it('Should not be abstract', function () {
        expect(mainstate.abstract).toBe(undefined);
      });
    });

    describe('Alternative Route (contact)', function () {
      let mainstate;
      beforeEach(inject(function ($state) {
        mainstate = $state.get('contact');
      }));

      it('Should have the correct URL (contact)', function () {
        expect(mainstate.url).toEqual('/contact');
      });

      it('Should not be abstract', function () {
        expect(mainstate.abstract).toBe(undefined);
      });
    });

    describe('Handle Trailing Slash', function () {
      beforeEach(inject(function ($state, $rootScope) {
        $state.go('support');
        $rootScope.$digest();
      }));

      it('Should remove trailing slash', inject(function (
        $state,
        $location,
        $rootScope,
      ) {
        $location.path('support/');
        $rootScope.$digest();

        expect($location.path()).toBe('/support');
      }));
    });
  });
});
