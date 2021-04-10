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
      url: '/messages/:username?userId',
      template:
        '<thread user="app.user" profileMinimumLength="app.appSettings.profileMinimumLength"></thread>',
      requiresAuth: true,
      footerHidden: true,
      data: {
        pageTitle: 'Messages',
      },
    });
}
