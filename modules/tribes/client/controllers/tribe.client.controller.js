angular.module('tribes').controller('TribeController', TribeController);

/* @ngInject */
function TribeController($scope, $state, tribe) {
  // ViewModel
  const vm = this;

  // Exposed to the view
  vm.tribe = tribe;
  vm.goBack = goBack;
  vm.circleWikiUrl = circleWikiUrl;

  // Ensure tribe in view updates when directives modify it
  $scope.$on('tribeUpdated', function (event, tribe) {
    vm.tribe = tribe;
  });

  /**
   * Go to tribe grid
   */
  function goBack() {
    $state.go('circles.list');
  }

  function circleWikiUrl(tribe) {
    const slug = tribe && tribe.slug;
    if (!slug) {
      return '';
    }

    return `https://wiki.trustroots.org/en/${encodeURIComponent(
      slug.charAt(0).toUpperCase() + slug.slice(1),
    )}`;
  }
}
