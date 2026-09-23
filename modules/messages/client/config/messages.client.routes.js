angular.module('messages').config(MessagesRoutes);

/* @ngInject */
function MessagesRoutes($stateProvider) {
  // Messages state routing
  $stateProvider
    .state('inbox', {
      url: '/messages',
      /* @ngInject */
      onEnter($window) {
        $window.location.assign('/messages');
      },
      requiresAuth: true,
      data: {
        pageTitle: 'Messages',
      },
    })
    .state('messageThread', {
      url: '/messages/:username?userId',
      /* @ngInject */
      onEnter($window, $stateParams) {
        const url = new URL(
          `/messages/${encodeURIComponent($stateParams.username)}`,
          $window.location.origin,
        );
        if ($stateParams.userId) {
          url.searchParams.set('userId', $stateParams.userId);
        }
        $window.location.assign(`${url.pathname}${url.search}`);
      },
      requiresAuth: true,
      footerHidden: true,
      data: {
        pageTitle: 'Messages',
      },
    });
}
