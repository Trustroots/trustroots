import AppConfig from '@/modules/core/client/app/config';
import angular from 'angular';

// Start by defining the main module and adding the module dependencies
angular.module(AppConfig.appModuleName, AppConfig.appModuleVendorDependencies);

// App configs
angular.module(AppConfig.appModuleName).config(initConfig);

/* @ngInject */
function initConfig(
  lockerProvider,
  cfpLoadingBarProvider,
  $analyticsProvider,
  $locationProvider,
  $urlMatcherFactoryProvider,
  $compileProvider,
  $uibTooltipProvider,
) {
  // Disable analytics for admin dash paths
  $analyticsProvider.excludeRoutes([/^\/admin/]);

  // Setting HTML5 Location Mode
  $locationProvider
    .html5Mode({
      enabled: true,
      // We do have <base> tag defined, but requiring it for Karma tests breaks tests...
      // @todo better solution?
      requireBase: false,
    })
    .hashPrefix('!');

  // Make a trailing slash optional for all routes (ui-router)
  // @link https://github.com/angular-ui/ui-router/wiki/Frequently-Asked-Questions#how-to-make-a-trailing-slash-optional-for-all-routes
  $urlMatcherFactoryProvider.strictMode(false);

  // Hide spinner from the loading interceptor
  // @link https://github.com/chieffancypants/angular-loading-bar
  cfpLoadingBarProvider.includeSpinner = false;

  // Configure local storage module
  // @link https://github.com/tymondesigns/angular-locker
  lockerProvider.defaults({
    driver: 'local', // local|session
    namespace: AppConfig.appModuleName,
    separator: '.',
    eventsEnabled: false,
    extend: {},
  });

  // Disabling Debug Data for production environment
  // @link https://docs.angularjs.org/guide/production
  if (AppConfig.appEnv === 'production') {
    $compileProvider.debugInfoEnabled(false);
  }

  // Disable comment and css class directives
  // @link https://docs.angularjs.org/guide/production#disable-comment-and-css-class-directives
  $compileProvider.commentDirectivesEnabled(false);
  $compileProvider.cssClassDirectivesEnabled(false);

  // Whitelist of safe urls during a[href] sanitization.
  // Unmatched URLs are prefixed with 'unsafe:' string.
  // @link https://docs.angularjs.org/api/ng/provider/$compileProvider#aHrefSanitizationWhitelist
  $compileProvider.aHrefSanitizationWhitelist(
    /^\s*(geo|https?|ftp|mailto|tel|webcal|data|blob):/,
  );

  // By default tooltips and popovers are appended to
  // '$body' instead of the parent element
  // @link https://angular-ui.github.io/bootstrap/#!#tooltip
  // @link https://angular-ui.github.io/bootstrap/#!#popover
  $uibTooltipProvider.options({
    appendToBody: true,
  });
}

// Then define the init function for starting up the application
angular.element(document).ready(function () {
  /* eslint-disable angular/window-service */

  // Escape from iframes if ordered to do so from URL.
  // Targeted for jumping out of Facebook Canvas.
  // Looks for `iframe_getaway` from URL parameters.
  if (
    window.location.search &&
    /iframe_getaway=true/.test(window.location.search)
  ) {
    // Open current URL to the same browser window, but on `_top` and
    // without `iframe_getaway` parameter, thus escaping the iframe.
    // Angular's `$window` nor `$location` services are not
    // available here yet so relying on vanilla JS.
    window.open(
      window.location.origin +
        window.location.pathname +
        window.location.search.replace('iframe_getaway', 'iframe_cleaned'),
      '_top',
    );
    // Don't bootstrap App, since we're reloading the page.
    return;
  }

  // Fixing facebook bug with redirect
  if (window.location.hash === '#_=_') window.location.hash = '';

  // Then init the app
  // @link https://docs.angularjs.org/guide/production#strict-di-mode
  angular.bootstrap(document, [AppConfig.appModuleName], {
    strictDi: AppConfig.appEnv === 'production',
  });

  // Register base service worker
  // This is required by `manifest.json` so that
  // the site can be added to the home screen.
  // @link https://developers.google.com/web/fundamentals/getting-started/primers/service-workers#register_a_service_worker
  if (navigator.serviceWorker) {
    navigator.serviceWorker.register('/sw.js', { scope: '/' });
  }

  /* eslint-enable angular/window-service */
});
