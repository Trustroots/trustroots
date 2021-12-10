import '@/modules/users/client/users.client.module';
import '@/modules/messages/client/messages.client.module';

/**
 * Application wide view controller
 */
angular.module('core').controller('AppController', AppController);

/* @ngInject */
function AppController(
  $location,
  $scope,
  $rootScope,
  $uibModal,
  $window,
  $state,
  $analytics,
  Authentication,
  SettingsFactory,
  Languages,
  locker,
  push,
  trNativeAppBridge,
) {
  // ViewModel
  const vm = this;

  // Exposed to the view
  vm.user = Authentication.user;
  vm.appSettings = SettingsFactory.get();
  vm.languageNames = Languages.get('object');
  vm.pageTitle = $window.title;
  vm.goHome = goHome;
  vm.signout = signout;
  vm.photoCredits = {};
  vm.photoCreditsCount = 0;
  vm.isFooterHidden = false;
  vm.isHeaderHidden = false;
  vm.isAboutPage = false;
  vm.isNativeMobileApp = trNativeAppBridge.isNativeMobileApp();

  // Default options for Medium-Editor directive used site wide
  // @link https://github.com/yabwe/medium-editor/blob/master/OPTIONS.md
  vm.editorOptions = {
    disableReturn: false,
    disableDoubleReturn: false,
    disableExtraSpaces: false,
    // Automatically turns URLs entered into
    // the text field into HTML anchor tags
    autoLink: false,
    paste: {
      // Forces pasting as plain text
      forcePlainText: false,
      // Cleans pasted content from different sources, like google docs etc
      cleanPastedHTML: true,
      // List of element attributes to remove during
      // paste when `cleanPastedHTML` is `true`
      cleanAttrs: [
        'class',
        'style',
        'dir',
        'id',
        'title',
        'target',
        'tabindex',
        'onclick',
        'oncontextmenu',
        'ondblclick',
        'onmousedown',
        'onmouseenter',
        'onmouseleave',
        'onmousemove',
        'onmouseover',
        'onmouseout',
        'onmouseup',
        'onwheel',
        'onmousewheel',
        'onmessage',
        'ontouchstart',
        'ontouchmove',
        'ontouchend',
        'ontouchcancel',
        'onload',
        'onscroll',
      ],
      // list of element tag names to remove during
      // paste when `cleanPastedHTML` is `true`
      cleanTags: [
        'link',
        'iframe',
        'frameset',
        'noframes',
        'object',
        'video',
        'audio',
        'track',
        'source',
        'base',
        'basefont',
        'applet',
        'param',
        'embed',
        'script',
        'meta',
        'head',
        'title',
        'svg',
        'script',
        'style',
        'input',
        'textarea',
        'form',
        'hr',
        'select',
        'optgroup',
        'label',
        'img',
        'canvas',
        'area',
        'map',
        'figure',
        'picture',
        'figcaption',
        'noscript',
      ],
      //  list of element tag names to unwrap (remove the element tag but retain
      // its child elements) during paste when `cleanPastedHTML` is `true`
      unwrapTags: [
        '!DOCTYPE',
        'html',
        'body',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'table',
        'th',
        'tr',
        'td',
        'tbody',
        'thead',
        'tfoot',
        'article',
        'header',
        'footer',
        'section',
        'aside',
        'font',
        'center',
        'big',
        'code',
        'pre',
        'small',
        'button',
        'label',
        'fieldset',
        'legend',
        'datalist',
        'keygen',
        'output',
        'nav',
        'main',
        'div',
        'span',
      ],
    },
    // Toolbar buttons which appear when highlighting text
    toolbar: {
      buttons: [
        {
          name: 'bold',
          contentDefault: '<span class="icon-bold"></span>',
        },
        {
          name: 'italic',
          contentDefault: '<span class="icon-italic"></span>',
        },
        {
          name: 'underline',
          contentDefault: '<span class="icon-underline"></span>',
        },
        {
          name: 'anchor',
          contentDefault: '<span class="icon-link"></span>',
        },
        {
          name: 'quote',
          contentDefault: '<span class="icon-quote"></span>',
        },
        {
          name: 'unorderedlist',
          contentDefault: '<span class="icon-list"></span>',
        },
      ],
    },
  };

  activate();

  /**
   * Initialize controller
   */
  function activate() {
    /**
     * Show "service unavailable" badge if http interceptor sends us this signal
     */
    $rootScope.$on('serviceUnavailable', function () {
      $uibModal.open({
        ariaLabelledBy: 'Service unavailable',
        template:
          '<div class="modal-body lead text-center">' +
          '  <p class="lead">Unfortunately Trustroots is down for a bit of maintenance right now.</p>' +
          '  <p>We expect to be back in a couple minutes. Thanks for your patience.</p>' +
          '  <p>In the meantime, check our ' +
          '    <a href="https://twitter.com/trustroots" target="_blank">Twitter account</a> or ' +
          '    <a href="http://status.trustroots.org/" target="_blank">status page</a> for news.</p>' +
          '</div>' +
          '<div class="modal-footer">' +
          '  <button class="btn btn-primary" type="button" ng-click="$dismiss()">OK</button>' +
          '</div>',
      });
    });

    /**
     * Snif and apply user changes
     */
    $scope.$on('userUpdated', function () {
      vm.user = Authentication.user;
    });

    /**
     * Before page change
     */
    $scope.$on('$stateChangeStart', function (event, toState, toParams) {
      if (toState.requiresRole) {
        if (!Authentication.user) {
          toState.requiresAuth = true;
        }
        // Check if user has the required role
        else if (
          Authentication.user &&
          !Authentication.user.roles.includes(toState.requiresRole)
        ) {
          event.preventDefault();
          $window.alert(
            'This page would require you to be a Trustroots volunteer. Wanna help us build Trustroots?',
          );
          $state.go('volunteering');
        }
      }

      // Redirect to login page if no user
      if (toState.requiresAuth && !Authentication.user) {
        // Cancel stateChange
        event.preventDefault();

        // Save previous state
        // See modules/users/client/controllers/authentication.client.controller.js for how they're used
        $rootScope.signinState = toState.name;
        $rootScope.signinStateParams = toParams;

        // Show a special signup ad for certain pages if user isn't authenticated
        // (Normally we just splash a signup page at this point)
        if (toState.name === 'profile') {
          $state.go('profile-signup');
        } else {
          // Or just continue to the signup page...
          $state.go('signin', { continue: true });
        }
      }
    });

    /**
     * After page change
     */
    $scope.$on('$stateChangeSuccess', function (event, toState) {
      // Footer is hidden on these pages
      vm.isFooterHidden =
        angular.isDefined(toState.footerHidden) &&
        toState.footerHidden === true;

      // Header is hidden on these pages
      vm.isHeaderHidden =
        angular.isDefined(toState.headerHidden) &&
        toState.headerHidden === true;

      // Reset photo copyrights on each page change
      // trBoards directive hits in after this and we'll fill this with potential photo credits
      vm.photoCredits = {};
      vm.photoCreditsCount = 0;

      // Reset page scroll on page change
      $window.scrollTo(0, 0);
    });

    /**
     * Sniff and apply photo credit changes
     */
    $scope.$on('photoCreditsUpdated', function (scope, photo) {
      angular.extend(vm.photoCredits, photo);
      vm.photoCreditsCount = Object.keys(vm.photoCredits).length;
    });

    $scope.$on('photoCreditsRemoved', function (scope, photo) {
      const photoName = Object.keys(photo)[0];
      // @TODO inconsistent results when there is the same photo displayed multiple times
      delete vm.photoCredits[photoName];
      vm.photoCreditsCount = Object.keys(vm.photoCredits).length;
    });
  }

  /**
   * Determine where to direct user from "home" links
   */
  function goHome() {
    if (Authentication.user) {
      $state.go('search.map');
    } else {
      $state.go('home');
    }
  }

  /**
   * Sign out authenticated user
   */
  function signout($event) {
    if ($event) {
      $event.preventDefault();
    }

    $analytics.eventTrack('signout', {
      category: 'authentication',
      label: 'Sign out',
    });

    // Clear out session/localstorage
    // @link https://github.com/tymondesigns/angular-locker#removing-items-from-locker
    if (locker.supported()) {
      locker.clean();
    }

    push.disable().finally(function () {
      // Do the signout and refresh the page
      $window.top.location.href = '/api/auth/signout';
    });

    // This will tell Mobile apps wrapping the site to disable push notifications at the device
    if (angular.isFunction($window.postMessage)) {
      $window.postMessage(
        'unAuthenticated',
        $location.protocol() + '://' + $location.host(),
      );
    }

    // Signal native mobile app we've unauthenticated
    trNativeAppBridge.signalUnAuthenticated();
  }
}
