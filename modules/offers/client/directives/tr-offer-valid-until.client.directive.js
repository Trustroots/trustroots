import templateUrl from '@/modules/offers/client/views/directives/tr-offer-valid-until.view.client.html';

/**
 * A directive to modify offer's `validUntil` dates
 */

angular
  .module('offers')
  .directive('trOfferValidUntil', trOfferValidUntilDirective);

/* @ngInject */
function trOfferValidUntilDirective() {
  const directive = {
    restrict: 'A',
    replace: false,
    scope: {
      validUntil: '=trOfferValidUntil',
    },
    templateUrl,
    controller: trOfferValidUntilDirectiveController,
    controllerAs: 'trOfferValidUntil',
  };

  return directive;

  /* @ngInject */
  function trOfferValidUntilDirectiveController(
    $scope,
    moment,
    SettingsFactory,
  ) {
    const appSettings = SettingsFactory.get();

    // View model
    const vm = this;

    vm.isCalendarVisible = false;

    // Default is one month
    vm.offerValidityInDays = 30;

    // Predefined options visible without calendar
    vm.choices = {
      'A week': 7,
      'Two weeks': 14,
      'Three weeks': 23,
      'A month': 30,
    };

    // Options for Angular-UI Bootstrap datepicker
    // https://angular-ui.github.io/bootstrap/#!#datepicker
    vm.calendarOptions = {
      showWeeks: false, // Hide week numbers
      maxDate: moment()
        .add(appSettings.limits.maxOfferValidFromNow || { days: 30 })
        .toDate(),
      minDate: new Date(), // @TODO: this could be server date instead of client date
      startingDay: 1, // Start week on Monday
      maxMode: 'month', // Disable year selector
    };

    activate();

    /**
     * Initialize controller
     */
    function activate() {
      // If date was prepopulated, just set directive to calendar mode
      if ($scope.validUntil) {
        vm.isCalendarVisible = true;
        vm.validUntil = $scope.validUntil;
      } else {
        setValidUntilDays(vm.offerValidityInDays);
      }

      $scope.$watch(
        'trOfferValidUntil.offerValidityInDays',
        function (newValue, oldValue) {
          if (newValue !== oldValue) {
            setValidUntilDays(newValue);
          }
        },
      );

      // Update $scope when view model updates
      $scope.$watch('trOfferValidUntil.validUntil', function (date) {
        $scope.validUntil = date;
      });
    }

    /**
     * Sets validity of offer to future by x days
     *
     * @param {Int} days Number of days to set to future
     */
    function setValidUntilDays(days) {
      days = parseInt(days, 10);

      // Defaults to max
      // @link https://momentjs.com/docs/#/manipulating/add/
      const add = days ? { days } : appSettings.limits.maxOfferValidFromNow;

      vm.validUntil = moment().endOf('day').add(add).toDate();
    }
  }
}
