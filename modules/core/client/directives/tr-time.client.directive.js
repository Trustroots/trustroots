/**
 * Directive that shows time taking into account user's time related settings.
 *
 * Clicking on time will change the way it's shown (betwen "ago"-time or absolute time).
 * When toggled, mode will be stored to localStorage
 *
 * Toggle click event won't propagate further in DOM so placing this inside clickable
 * elements will cause time to toggle, but underlaying button won't be clicked.
 *
 * Relies on MomentJS and Angular-Moment
 * @link http://momentjs.com/docs/
 * @link https://github.com/urish/angular-moment
 *
 * Basic usage:
 * <time tr-time="Date object or String"></time>
 *
 * Adjust tooltip:
 * <time tr-time="Date object or String" tr-time-tooltip-placement="bottom"></time>
 *
 * Tooltip attribute is passed on to UI-Bootstrap directive
 *
 * Pass time format:
 * <time tr-time="Date object or String" tr-time-format="'mediumDate'"></time>
 *
 * See formats: https://docs.angularjs.org/api/ng/filter/date
 */
angular.module('core').directive('trTime', trTimeDirective);

/* @ngInject */
function trTimeDirective($log, $rootScope, $parse, locker) {
  return {
    restrict: 'A',
    replace: false,
    template:
      '<time ng-click="toggleMode($event)" aria-label="Change time presentation">' +
      '<span ng-if="timeModeAgo" am-time-ago="::sourceTime" uib-tooltip="{{ ::sourceTime | date:trTimeFormat }}" tooltip-placement="{{ ::tooltipPlacement }}"></span>' +
      '<span ng-if="!timeModeAgo">{{ ::sourceTime | date:trTimeFormat }}</span>' +
      '</time>',
    scope: {
      trTime: '@',
      trTimeTooltipPlacement: '@',
      trTimeFormat: '=?', // `?` makes it optional
    },
    link(scope, element, attrs) {
      if (!scope.trTime) {
        $log.warn('No time passed for tr-time directive.');
        return;
      }

      // Default to 'medium' time format, see formats:
      // @link https://docs.angularjs.org/api/ng/filter/date
      scope.trTimeFormat = scope.trTimeFormat || 'medium';

      // Set tooltip placement, default to 'bottom'
      scope.tooltipPlacement = scope.trTimeTooltipPlacement || 'bottom';

      // Avoid creating watchers for this time since it needs to be passed only once
      // @link https://stackoverflow.com/questions/30193069/angularjs-directive-creates-watches/30194100#30194100
      scope.sourceTime = $parse(attrs.trTime)(scope.$parent);

      // Get setting from cache, use default (true) if it doesn't exist
      scope.timeModeAgo = locker.supported()
        ? Boolean(locker.get('timeAgo', true))
        : true;

      // Sync mode if other directive changes time mode
      scope.$on('timeModeAgoChanged', timeModeAgoChanged);
      function timeModeAgoChanged($event, newTimeModeAgo) {
        if (scope.timeModeAgo !== newTimeModeAgo) {
          scope.timeModeAgo = newTimeModeAgo;
        }
      }

      // Toggle viewing time between 'ago' and time format.
      // Saves setting to localStorage if it's available
      scope.toggleMode = function ($event) {
        $event.preventDefault();
        $event.stopPropagation();

        scope.timeModeAgo = !scope.timeModeAgo;

        // Save setting to cache
        if (locker.supported()) {
          locker.put('timeAgo', scope.timeModeAgo);
        }

        // Tell other directives to update their mode as well
        $rootScope.$broadcast('timeModeAgoChanged', scope.timeModeAgo);
      };
    },
  };
}
