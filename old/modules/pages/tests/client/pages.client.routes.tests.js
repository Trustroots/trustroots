import '@/modules/pages/client/pages.client.module';
import AppConfig from '@/modules/core/client/app/config';
// TODO import { $broadcast } from '@/modules/core/client/services/angular-compat';
// TODO jest.mock('@/modules/core/client/services/angular-compat');

describe('Pages Route Tests', function () {
  // We can start by loading the main application module
  beforeEach(angular.mock.module(AppConfig.appModuleName));

  // Disable $urlRouterProvider transitions
  // You should comment this out if you want to test route transitions (e.g. "adding trailing slash"-test)
  // See http://stackoverflow.com/a/26613169/1984644 for more
  beforeEach(
    angular.mock.module(function ($urlRouterProvider) {
      $urlRouterProvider.deferIntercept();
    }),
  );

  describe('Route Config', function () {
    describe('Rules Route', function () {
      let mainstate;
      beforeEach(inject(function ($state) {
        mainstate = $state.get('rules');
      }));

      it('Should have the correct URL', function () {
        expect(mainstate.url).toEqual('/rules');
      });

      it('Should not be abstract', function () {
        expect(mainstate.abstract).toBe(undefined);
      });
    });

    describe('Team Route', function () {
      let mainstate;
      beforeEach(inject(function ($state) {
        mainstate = $state.get('team');
      }));

      it('Should have the correct URL', function () {
        expect(mainstate.url).toEqual('/team');
      });

      it('Should not be abstract', function () {
        expect(mainstate.abstract).toBe(undefined);
      });
    });

    describe('Privacy Route', function () {
      let mainstate;
      beforeEach(inject(function ($state) {
        mainstate = $state.get('privacy');
      }));

      it('Should have the correct URL', function () {
        expect(mainstate.url).toEqual('/privacy');
      });

      it('Should not be abstract', function () {
        expect(mainstate.abstract).toBe(undefined);
      });
    });

    describe('Contribute Route', function () {
      let mainstate;
      beforeEach(inject(function ($state) {
        mainstate = $state.get('contribute');
      }));

      it('Should have the correct URL', function () {
        expect(mainstate.url).toEqual('/contribute');
      });

      it('Should not be abstract', function () {
        expect(mainstate.abstract).toBe(undefined);
      });
    });

    describe('FAQ Route', function () {
      let mainstate;
      beforeEach(inject(function ($state) {
        mainstate = $state.get('faq');
      }));

      it('Should have the correct URL', function () {
        expect(mainstate.url).toEqual('/faq');
      });

      it('Should not be abstract', function () {
        expect(mainstate.abstract).toBe(true);
      });
    });

    describe('FAQ Sub Route', function () {
      let mainstate;
      beforeEach(inject(function ($state) {
        mainstate = $state.get('faq.foundation');
      }));

      it('Should have the correct URL', function () {
        expect(mainstate.url).toEqual('/foundation');
      });

      it('Should not be abstract', function () {
        expect(mainstate.abstract).toBe(undefined);
      });
    });

    describe('Foundation Route', function () {
      let mainstate;
      beforeEach(inject(function ($state) {
        mainstate = $state.get('foundation');
      }));

      it('Should have the correct URL', function () {
        expect(mainstate.url).toEqual('/foundation');
      });

      it('Should not be abstract', function () {
        expect(mainstate.abstract).toBe(undefined);
      });
    });

    describe('Media Route', function () {
      let mainstate;
      beforeEach(inject(function ($state) {
        mainstate = $state.get('media');
      }));

      it('Should have the correct URL', function () {
        expect(mainstate.url).toEqual('/media');
      });

      it('Should not be abstract', function () {
        expect(mainstate.abstract).toBe(undefined);
      });
    });

    describe('Volunteering Route', function () {
      let mainstate;
      beforeEach(inject(function ($state) {
        mainstate = $state.get('volunteering');
      }));

      it('Should have the correct URL', function () {
        expect(mainstate.url).toEqual('/volunteering');
      });

      it('Should not be abstract', function () {
        expect(mainstate.abstract).toBe(undefined);
      });
    });

    describe('Guide Route', function () {
      let mainstate;
      beforeEach(inject(function ($state) {
        mainstate = $state.get('guide');
      }));

      it('Should have the correct URL', function () {
        expect(mainstate.url).toEqual('/guide');
      });

      it('Should not be abstract', function () {
        expect(mainstate.abstract).toBe(undefined);
      });
    });

    describe('Mobile Navigation Route', function () {
      let mainstate;
      beforeEach(inject(function ($state) {
        mainstate = $state.get('navigation');
      }));

      it('Should have the correct URL', function () {
        expect(mainstate.url).toEqual('/navigation');
      });

      it('Should not be abstract', function () {
        expect(mainstate.abstract).toBe(undefined);
      });

      it('Should require authentication', function () {
        expect(mainstate.requiresAuth).toBe(true);
      });
    });
  });
});
