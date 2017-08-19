(function () {
  'use strict';

  angular
    .module('pages')
    .run(HomeRunBlock)
    .controller('HomeController', HomeController);

  /* @ngInject */
  function HomeRunBlock($location, $window, $state, Authentication) {
    // When landing to frontpage as authenticated user, redirect to search
    if (Authentication.user && $location.path() === '/') {
      $location.path('/search');
    }

    /**
     * When the site is wrapped on mobile,
     * we have these global variables in use:
     *
     * {Boolean} isMobileApp
     * {String} mobileVersion
     * {String} mobilePlatform
     * {String} mobileDeviceName
     * {String} mobileDeviceYearClass
     */
    if ($window.isMobileApp) {
      $location.path('/signin');
    }
  }

  /* @ngInject */
  function HomeController($stateParams, Authentication, TribesService, TribeService) {

    var headerHeight = angular.element('#tr-header').height() || 0;

    // View model
    var vm = this;
    vm.tribesLoaded = false;

    // Exposed to the view
    vm.windowHeight = angular.element('html').height() - headerHeight;

    // Load front page's landing photos
    // @TODO Move part of this logic data to the DB
    if ($stateParams.tribe && ['hitchhikers', 'dumpster-divers', 'punks'].indexOf($stateParams.tribe) > -1) {
      // Photos for these 3 tribes
      vm.boards = [
        'rainbowpeople',
        'hitchroad',
        'desertgirl',
        'hitchgirl1',
        'hitchgirl2',
        'hitchtruck'
      ];
    } else {
      vm.boards = Authentication.user ?
        // Photos for authenticated users
        [
          'woman-bridge',
          'wavewatching',
          'sahara-backpacker'
        ] :
        // Photos for non-authenticated users
        [
          'woman-bridge',
          'rainbowpeople',
          'hitchroad',
          'hitchgirl1',
          'wavewatching',
          'sahara-backpacker',
          'hitchtruck'
        ];
    }

    // Load suggested tribes
    vm.tribes = TribesService.query({
      limit: 3
    }, function() {
      // Got those three tribes, now fetch one more if requested
      if ($stateParams.tribe && $stateParams.tribe !== '') {

        // Loop trough tribes to see if requested tribe is already there, and simply move it to be first
        var foundTribeFromArray = false;
        angular.forEach(vm.tribes, function(tribe) {
          if (tribe.slug === $stateParams.tribe) {
            foundTribeFromArray = true;
          }
        });
        if (!foundTribeFromArray) {
          vm.tribe = TribeService.get({
            tribeSlug: $stateParams.tribe
          });
          vm.tribe.then(function(tribe) {
            // If tribe was found, put it to the beginning of `vm.tribes` array
            if (tribe && tribe._id) {
              vm.tribes.unshift(tribe);
            }
            vm.tribesLoaded = true;
          });
        } else {
          vm.tribesLoaded = true;
        }

      } else {
        vm.tribesLoaded = true;
      }
    });

  }

}());
