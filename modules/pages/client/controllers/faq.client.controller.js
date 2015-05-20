'use strict';

angular.module('pages').controller('FaqController', ['$scope', '$timeout', '$window',
  function($scope, $timeout, $window) {

    // Toggles for accordion
    $scope.sidebar = {

      // Toggles for each invidual panel
      isCommunityOpen: true,
      isOrganisationOpen: true,
      isTechnologyOpen: true,

      // Close other panels if one is open?
      closeOthers: false
    };

    // Determine if sidebar should be scrolling or not
    $timeout(function(){
      if($window.innerHeight <= angular.element('#faq-sidebar').height()) {
        $scope.sidebar.isCommunityOpen = false;
        $scope.sidebar.isOrganisationOpen = false;
        $scope.sidebar.isTechnologyOpen = false;
        $scope.sidebar.closeOthers = true;
      }
    });
    // Determine fixed width for the sidebar so it doesn't overflow when it gets fixed position
    angular.element('#faq-sidebar').css({ 'max-width': angular.element('#faq-sidebar').width() });


    // Scroll/highlight FAQ question when clicking question at sidebar
    var $body = angular.element('body');
    $scope.readFAQ = function(id) {
      var $el = angular.element('#' + id);

      // Scroll to element
      $body.animate({scrollTop: $el.offset().top - 60}, 'fast');

      // Performs color flash for link, see faq.less for more.
      // Animation time at CSS is 1000ms
      $el.addClass('faq-question-flash');
      $timeout(function(){
        $el.removeClass('faq-question-flash');
      }, 1010);
    };

  }
]);
