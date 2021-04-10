/**
 * @ngdoc directive
 *
 * @name trustroots:trDateSelect
 *
 * Fork of https://github.com/sambs/angular-sb-date-select with additional features:
 * - allows choosing empty values
 * - allows passing our own templates
 *
 * Relies on MomentJS
 * @link http://momentjs.com/
 *
 */
angular
  .module('core')

  .run([
    '$templateCache',
    function ($templateCache) {
      const template = [
        '<div class="sb-date-select">',
        '  <select class="sb-date-select-day sb-date-select-select" ng-class="selectClass" ng-model="val.date" ng-options="d for d in dates track by d">',
        '    <option value disabled selected>Day</option>',
        '  </select>',
        '  <select class="sb-date-select-month sb-date-select-select" ng-class="selectClass" ng-model="val.month" ng-options="m.value as m.name for m in months">',
        '  <option value disabled>Month</option>',
        '  </select>',
        '  <select class="sb-date-select-year sb-date-select-select" ng-class="selectClass" ng-model="val.year" ng-options="y for y in years">',
        '    <option value disabled selected>Year</option>',
        '  </select>',
        '</div>',
      ];

      $templateCache.put('tr-date-select.html', template.join(''));
    },
  ])

  .directive('trDateSelect', [
    function () {
      return {
        restrict: 'A',
        replace: true,
        templateUrl($element, $attrs) {
          return $attrs.templateUrl || 'tr-date-select.html';
        },
        require: 'ngModel',
        scope: {
          disabled: '=ngDisabled',
          selectClass: '@trSelectClass',
        },

        link(scope, elem, attrs, ngModel) {
          scope.val = {};

          const min = (scope.min = moment(attrs.min || '1900-01-01'));
          const max = (scope.max = moment(attrs.max)); // Defaults to now

          scope.years = [];

          for (let i = max.year(); i >= min.year(); i--) {
            scope.years.push(i);
          }

          scope.$watch('val.year', function () {
            updateMonthOptions();
          });

          scope.$watchCollection('[val.month, val.year]', function () {
            updateDateOptions();
          });

          scope.$watchCollection(
            '[val.date, val.month, val.year]',
            function (newDate, oldDate) {
              if (scope.val.year && scope.val.month && scope.val.date) {
                if (!angular.equals(newDate, oldDate)) {
                  const m = moment([
                    scope.val.year,
                    scope.val.month - 1,
                    scope.val.date,
                  ]);
                  ngModel.$setViewValue(m.format('YYYY-MM-DD'));
                }
              } else {
                ngModel.$setViewValue(null);
              }
            },
          );

          function updateMonthOptions() {
            // Values begin at 1 to permit easier boolean testing
            scope.months = [];

            const minMonth =
              scope.val.year && min.isSame([scope.val.year], 'year')
                ? min.month()
                : 0;
            const maxMonth =
              scope.val.year && max.isSame([scope.val.year], 'year')
                ? max.month()
                : 11;

            const monthNames = moment.months();

            for (let j = minMonth; j <= maxMonth; j++) {
              scope.months.push({
                name: monthNames[j],
                value: j + 1,
              });
            }

            if (
              scope.val.month - 1 > maxMonth ||
              scope.val.month - 1 < minMonth
            ) {
              delete scope.val.month;
            }
          }

          function updateDateOptions() {
            let minDate;
            let maxDate;

            if (
              scope.val.year &&
              scope.val.month &&
              min.isSame([scope.val.year, scope.val.month - 1], 'month')
            ) {
              minDate = min.date();
            } else {
              minDate = 1;
            }

            if (
              scope.val.year &&
              scope.val.month &&
              max.isSame([scope.val.year, scope.val.month - 1], 'month')
            ) {
              maxDate = max.date();
            } else if (scope.val.year && scope.val.month) {
              maxDate = moment([
                scope.val.year,
                scope.val.month - 1,
              ]).daysInMonth();
            } else {
              maxDate = 31;
            }

            scope.dates = [];

            for (let i = minDate; i <= maxDate; i++) {
              scope.dates.push(i);
            }
            if (scope.val.date < minDate || scope.val.date > maxDate) {
              delete scope.val.date;
            }
          }

          // ngModel -> view
          ngModel.$render = function () {
            if (!ngModel.$viewValue) return;

            const m = moment(new Date(ngModel.$viewValue));

            // Always use a dot in ng-model attrs...
            scope.val = {
              year: m.year(),
              month: m.month() + 1,
              date: m.date(),
            };
          };
        },
      };
    },
  ]);
