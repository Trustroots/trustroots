angular.module('core').config(CoreRoutes);

/* @ngInject */
function CoreRoutes($stateProvider, $urlRouterProvider) {
  // Remove trailing slash from routes
  $urlRouterProvider.rule(function ($injector, $location) {
    const path = $location.path();
    const hasTrailingSlash = path.length > 1 && path[path.length - 1] === '/';

    if (hasTrailingSlash) {
      // If last character is a slash, return the same url without the slash
      const newPath = path.substr(0, path.length - 1);
      $location.replace().path(newPath);
    }
  });

  // Redirect to 404 when route not found
  $urlRouterProvider.otherwise('not-found');

  $stateProvider.state('not-found', {
    url: '/not-found',
    template: '<not-found-page></not-found-page>',
    footerHidden: true,
    headerHidden: true,
    data: {
      pageTitle: 'Not found',
    },
  });
}
