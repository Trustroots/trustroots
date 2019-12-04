(function () {
  /**
   * PollMessagesCount service used for automatically polling for unread message counter
   *
   * For service to communicate with message count REST API endpoints, see `MessagesCount` service.
   */
  angular
    .module('messages')
    .factory('PollMessagesCount', PollMessagesCountFactory);

  /* @ngInject */
  function PollMessagesCountFactory($interval, $rootScope, MessagesCount, Authentication) {

    const highFrequency = 2 * 60 * 1000; // once every 2 minutes
    const lowFrequency = 5 * 60 * 1000; // once every 5 minutes
    let frequency = highFrequency;
    let isPolling = false;
    let unreadCount = 0;
    let pollingInterval;

    // Return the public API
    return {
      setFrequency: setFrequency,
      getUnreadCount: getUnreadCount,
      initPolling: initPolling,
      poll: poll
    };

    /**
     * Initialize polling for unread messages
     */
    function initPolling() {
      if (angular.isDefined(pollingInterval)) {
        return;
      }

      // Activate listener
      $rootScope.$on('syncUnreadMessagesCount', poll);

      // Check for unread messages in intervals
      setPollingInterval();
    }

    /**
     * Re-set intervall to current frequency
     */
    function setPollingInterval() {
      // Clear out possible old interval
      if (angular.isDefined(pollingInterval)) {
        $interval.cancel(pollingInterval);
        pollingInterval = undefined;
      }

      // Set new interval
      pollingInterval = $interval(poll, frequency);
    }

    /**
     * Check for unread messages
     */
    function poll() {
      if (isPolling) {
        return;
      }
      isPolling = true;
      MessagesCount.get(function (data) {
        isPolling = false;

        const newUnreadCount = (data && data.unread) ? parseInt(data.unread, 10) : 0;

        if (unreadCount !== newUnreadCount) {
          unreadCount = newUnreadCount;
          $rootScope.$broadcast('unreadCountUpdated', newUnreadCount);
        }
      });
    }

    /**
     * Return current unread count
     */
    function getUnreadCount() {
      return unreadCount;
    }

    /**
     * Set the frequency
     */
    function setFrequency(frequencyString) {
      const newFrequency = (frequencyString === 'low') ? lowFrequency : highFrequency;

      if (newFrequency !== frequency) {
        frequency = newFrequency;
        setPollingInterval();
        // When turning to high frequency, poll on frequency change
        if (frequencyString === 'high' && Authentication.user && Authentication.user.public) {
          poll();
        }
      }
    }

  }
}());
