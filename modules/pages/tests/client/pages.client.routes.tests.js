import '@/modules/pages/client/pages.client.module';
import AppConfig from '@/modules/core/client/app/config';

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

      it('Should have templateUrl', function () {
        expect(mainstate.templateUrl).toBe(
          '/modules/pages/views/rules.client.view.html',
        );
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

      it('Should have templateUrl', function () {
        expect(mainstate.templateUrl).toBe(
          '/modules/pages/views/team.client.view.html',
        );
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

      it('Should have templateUrl', function () {
        expect(mainstate.templateUrl).toBe(
          '/modules/pages/views/privacy.client.view.html',
        );
      });
    });

    describe('Donate Route', function () {
      let mainstate;
      beforeEach(inject(function ($state) {
        mainstate = $state.get('donate');
      }));

      it('Should have the correct URL', function () {
        expect(mainstate.url).toEqual('/donate');
      });

      it('Should not be abstract', function () {
        expect(mainstate.abstract).toBe(undefined);
      });

      it('Should have templateUrl', function () {
        expect(mainstate.templateUrl).toBe(
          '/modules/pages/views/donate.client.view.html',
        );
      });
    });

    describe('Donation help Route', function () {
      let mainstate;
      beforeEach(inject(function ($state) {
        mainstate = $state.get('donate-help');
      }));

      it('Should have the correct URL', function () {
        expect(mainstate.url).toEqual('/donate/help');
      });

      it('Should not be abstract', function () {
        expect(mainstate.abstract).toBe(undefined);
      });

      it('Should have templateUrl', function () {
        expect(mainstate.templateUrl).toBe(
          '/modules/pages/views/donate-help.client.view.html',
        );
      });
    });

    describe('Donation policy Route', function () {
      let mainstate;
      beforeEach(inject(function ($state) {
        mainstate = $state.get('donate-policy');
      }));

      it('Should have the correct URL', function () {
        expect(mainstate.url).toEqual('/donate/policy');
      });

      it('Should not be abstract', function () {
        expect(mainstate.abstract).toBe(undefined);
      });

      it('Should have templateUrl', function () {
        expect(mainstate.templateUrl).toBe(
          '/modules/pages/views/donate-policy.client.view.html',
        );
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

      it('Should have templateUrl', function () {
        expect(mainstate.templateUrl).toBe(
          '/modules/pages/views/faq.client.view.html',
        );
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

      it('Should have templateUrl', function () {
        expect(mainstate.templateUrl).toBe(
          '/modules/pages/views/faq-foundation.client.view.html',
        );
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

      it('Should have templateUrl', function () {
        expect(mainstate.templateUrl).toBe(
          '/modules/pages/views/foundation.client.view.html',
        );
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

      it('Should have templateUrl', function () {
        expect(mainstate.templateUrl).toBe(
          '/modules/pages/views/media.client.view.html',
        );
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

      it('Should have template', function () {
        expect(mainstate.template).toBeDefined();
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

      it('Should have templateUrl', function () {
        expect(mainstate.templateUrl).toBe(
          '/modules/pages/views/guide.client.view.html',
        );
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

      it('Should have templateUrl', function () {
        expect(mainstate.templateUrl).toBe(
          '/modules/pages/views/navigation.client.view.html',
        );
      });

      it('Should require authentication', function () {
        expect(mainstate.requiresAuth).toBe(true);
      });
    });
  });
});
