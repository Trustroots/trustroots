import messageThreadTemplateUrl from '@/modules/messages/client/views/thread.client.view.html';

angular.module('messages').config(MessagesRoutes);

/* @ngInject */
function MessagesRoutes($stateProvider) {
  // Messages state routing
  $stateProvider
    .state('inbox', {
      url: '/messages',
      template: '<inbox user="app.user"></inbox>',
      requiresAuth: true,
      data: {
        pageTitle: 'Messages',
      },
    })
    .state('messageThread', {
      url: '/messages/:username',
      templateUrl: messageThreadTemplateUrl,
      controller: 'MessagesThreadController',
      controllerAs: 'thread',
      requiresAuth: true,
      footerHidden: true,
      resolve: {
        // A string value resolves to a service
        UserProfilesService: 'UserProfilesService',
        SettingsService: 'SettingsService',

        userTo: function(UserProfilesService, $stateParams) {
          return UserProfilesService.get({ username: $stateParams.username });
        },
        appSettings: function(SettingsService) {
          return SettingsService.get();
        },
      },
      data: {
        pageTitle: 'Messages',
      },
    });
}
