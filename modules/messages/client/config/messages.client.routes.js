(function () {
  angular
    .module('messages')
    .config(MessagesRoutes);

  /* @ngInject */
  function MessagesRoutes($stateProvider) {

    // Messages state routing
    $stateProvider.
      state('inbox', {
        url: '/messages',
        templateUrl: require('@/modules/messages/client/views/inbox.client.view.html'),
        controller: 'InboxController',
        controllerAs: 'inbox',
        requiresAuth: true,
        data: {
          pageTitle: 'Messages'
        }
      }).
      state('messageThread', {
        url: '/messages/:username',
        templateUrl: require('@/modules/messages/client/views/thread.client.view.html'),
        controller: 'MessagesThreadController',
        controllerAs: 'thread',
        requiresAuth: true,
        footerHidden: true,
        resolve: {
          // A string value resolves to a service
          UserProfilesService: 'UserProfilesService',
          SettingsService: 'SettingsService',

          userTo: function (UserProfilesService, $stateParams) {
            return UserProfilesService.get({ username: $stateParams.username });
          },
          appSettings: function (SettingsService) {
            return SettingsService.get();
          }
        },
        data: {
          pageTitle: 'Messages'
        }
      });
  }
}());
