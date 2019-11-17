(function () {
  angular
    .module('pages')
    .run(HomeRunBlock)
    .controller('HomeController', HomeController);

  /* @ngInject */
  function HomeRunBlock($location, $window, Authentication) {
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
  function HomeController($stateParams, $window, TribesService, TribeService) {

    const headerHeight = angular.element('#tr-header').height() || 0;

    // View model
    const vm = this;

    // Exposed to the view
    vm.boardHeight = $window.innerWidth <= 480 && $window.innerHeight < 700 ? 400 : $window.innerHeight - headerHeight + 14;

    // Load front page's landing photos
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
      vm.boards = [
        'woman-bridge',
        'rainbowpeople',
        'hitchroad',
        'hitchgirl1',
        'wavewatching',
        'sahara-backpacker',
        'hitchtruck'
      ];
    }

    function isTribeLoaded(tribeSlug) {
      angular.forEach(vm.tribes, function (tribe) {
        if (tribe.slug === tribeSlug) {
          return true;
        }
      });

      return false;
    }

    // Load suggested tribes
    vm.tribes = TribesService.query({
      limit: 3
    }, function () {
      // Got those three tribes, now fetch one more if requested
      if ($stateParams.tribe && !isTribeLoaded($stateParams.tribe)) {
        TribeService.get({
          tribeSlug: $stateParams.tribe
        }).then(function (tribe) {
          // If tribe was found, put it to the beginning of `vm.tribes` array
          if (tribe && tribe._id) {
            vm.tribes.unshift(tribe);
          }
        });
      }
    });

  }
}());
