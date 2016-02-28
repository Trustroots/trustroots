(function(){
  'use strict';

  /**
   * Directive that shows time taking into account user's time related settings.
   *
   * Clicking on time will change the way it's shown (betwen "ago"-time or absolute time).
   * When toggled, mode will be stored to localStorage
   *
   * Toggle click event won't propagate further in DOM so placing this inside clickable
   * elements will cause time to toggle, but underlaying button won't be clicked.
   *
   * Relies on MomentJS
   * @link http://momentjs.com/docs/
   *
   * Usage:
   * <time tr-time="Date object or String"></time>
   *
   * Or:
   * <time tr-time="Date object or String" tr-time-tooltip-placement="bottom"></time>
   *
   * Tooltip attribute is passed on to UI-Bootstrap directive
   */
  angular
    .module('core')
    .directive('trTime', trTimeDirective);

  /* @ngInject */
  function trTimeDirective($log, $parse, locker) {
    return {
      restrict: 'A',
      replace: false,
      template: '<time ng-click="toggleMode($event)" ng-bind="timeVisible" uib-tooltip="{{ timeTooltip }}" tooltip-placement="{{ ::tooltipPlacement }}"></time>',
      scope: {
        trTime: '@',
        trTimeTooltipPlacement: '@'
      },
      link: function(scope, el, attrs, ctrl) {

        if(!scope.trTime) {
          $log.warn('No time passed for tr-time directive.');
          return;
        }

        // Set tooltip placement, default to 'bottom'
        scope.tooltipPlacement = scope.trTimeTooltipPlacement || 'bottom';

        // Avoid creating watchers for this time since it needs to be passed only once
        // @link https://stackoverflow.com/questions/30193069/angularjs-directive-creates-watches/30194100#30194100
        var sourceTime = $parse(attrs.trTime)(scope.$parent);

        // Get setting from cache, use default (true) if it doesn't exist
        var timeModeAgo = (locker.supported()) ? Boolean(locker.get('timeAgo', true)) : true;

        // Init time objects
        var momentTime = moment(sourceTime);
        var timeAgo = momentTime.fromNow();
        var timeRaw = momentTime.format('ddd, MMMM D YYYY \\a\\t HH:mm');

        // Set moment object
        scope.setTime = function() {
          if(timeModeAgo) {
            scope.timeTooltip = timeRaw;
            scope.timeVisible = timeAgo;
          }
          else {
            scope.timeTooltip = timeAgo;
            scope.timeVisible = timeRaw;
          }
        };
        scope.setTime();

        // Toggle viewing time between 'ago' and time format.
        // Saves setting to localStorage if it's available
        scope.toggleMode = function($event) {

          $event.preventDefault();
          $event.stopPropagation();

          timeModeAgo = !timeModeAgo;

          // Update time format at scope
          scope.setTime();

          // Save setting to cache
          locker.put('timeAgo', timeModeAgo);
        };

      }
    };
  }

})();
