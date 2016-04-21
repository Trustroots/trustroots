(function(){
  'use strict';

  /**
   * Application wide view controller
   */
  angular
    .module('core')
    .controller('AppController', AppController);

  /* @ngInject */
  function AppController($scope, $rootScope, $window, $state, $analytics, Authentication, SettingsFactory, Languages, locker) {

    // ViewModel
    var vm = this;

    // Exposed to the view
    vm.user = Authentication.user;
    vm.appSettings = SettingsFactory.get();
    vm.languageNames = Languages.get('object');
    vm.pageTitle = $window.title;
    vm.goHome = goHome;
    vm.signout = signout;
    vm.photoCredits = {};
    vm.photoCreditsCount = 0;

    // Default options for Medium-Editor directive used site wide
    // @link https://github.com/yabwe/medium-editor/blob/master/OPTIONS.md
    vm.editorOptions = {
      disableReturn: false,
      disableDoubleReturn: false,
      disableExtraSpaces: false,
      autoLink: true, // automatically turns URLs entered into the text field into HTML anchor tags
      toolbar: {
        buttons: [{
            name: 'bold',
            contentDefault: '<span class="icon-bold"></span>'
          }, {
            name: 'italic',
            contentDefault: '<span class="icon-italic"></span>'
          }, {
            name: 'underline',
            contentDefault: '<span class="icon-underline"></span>'
          }, {
            name: 'anchor',
            contentDefault: '<span class="icon-link"></span>'
          }, {
            name: 'quote',
            contentDefault: '<span class="icon-quote"></span>'
          }, {
            name: 'unorderedlist',
            contentDefault: '<span class="icon-list"></span>'
          }]
      }
    };

    activate();

    /**
     * Initialize controller
     */
    function activate() {

      /**
       * Snif and apply user changes
       */
      $scope.$on('userUpdated', function() {
        vm.user = Authentication.user;
      });

      /**
       * Before page change
       */
      $scope.$on('$stateChangeStart', function(event, toState, toParams, fromState, fromParams) {

        // Redirect to login page if no user
        if(toState.requiresAuth && !Authentication.user) {
          // Cancel stateChange
          event.preventDefault();

          // Save previous state
          // See modules/users/client/controllers/authentication.client.controller.js for how they're used
          $rootScope.signinState = toState.name;
          $rootScope.signinStateParams = toParams;

          // Show a special signup ad for certain pages if user isn't authenticated
          // (Normally we just splash a signup page at this point)
          if(toState.name === 'profile') {
            $state.go('profile-signup');
          }
          else if(toState.name === 'search') {
            $state.go('search-signin', toParams || {});
          }
          // Or just continue to the signup page
          else {
            $state.go('signin', {'continue': true});
          }
        }

      });

      /**
       * After page change
       */
      $scope.$on('$stateChangeSuccess', function(event, toState, toParams, fromState, fromParams) {

        // Set page title
        vm.pageTitle = (toState.title) ? toState.title + ' - ' + $window.title : $window.title;

        // Reset photo copyrights on each page change
        // trBoards directive hits in after this and we'll fill this with potential photo credits
        vm.photoCredits = {};
        vm.photoCreditsCount = 0;

        // Reset page scroll on page change
        $window.scrollTo(0,0);
      });

      /**
       * Sniff and apply photo credit changes
       */
      $scope.$on('photoCreditsUpdated', function(scope, photo) {
        angular.extend(vm.photoCredits, photo);
        vm.photoCreditsCount++;
      });

    }

    /**
     * Determine where to direct user from "home" links
     */
    function goHome() {
      if(Authentication.user) {
        $state.go('search');
      }
      else {
        $state.go('home');
      }
    }

    /**
     * Sign out authenticated user
     */
    function signout($event) {
      if($event) {
        $event.preventDefault();
      }

      $analytics.eventTrack('signout', {
        category: 'authentication',
        label: 'Sign out'
      });

      // Clear out session/localstorage
      // @link https://github.com/tymondesigns/angular-locker#removing-items-from-locker
      locker.clean();

      // Do the signout and refresh the page
      $window.top.location.href  = '/api/auth/signout';
    }


  }

})();
