angular.module('tribes').config(TribesRoutes);

function openReactCircle($window, $stateParams) {
  const suffix = $stateParams.circle
    ? `/${encodeURIComponent($stateParams.circle)}`
    : '';
  $window.location.assign(`/circles${suffix}`);
}
openReactCircle.$inject = ['$window', '$stateParams'];

/* @ngInject */
function TribesRoutes($stateProvider) {
  $stateProvider
    .state('circles', {
      url: '/circles',
      abstract: true,
      template: '<ui-view/>',
    })
    .state('circles.list', { url: '', onEnter: openReactCircle })
    .state('circles.circle', {
      url: '/:circle',
      onEnter: openReactCircle,
    });
}
