angular.module('admin').config(AdminRoutes);

/* @ngInject */
function AdminRoutes($stateProvider) {
  $stateProvider
    .state('admin', {
      url: '/admin',
      template: '<admin></admin>', // This should be lowercase
      requiresRole: 'admin',
      requiresAuth: true,
      footerHidden: true,
      data: {
        pageTitle: 'Admin',
      },
    })
    .state('admin-audit-log', {
      url: '/admin/audit-log',
      // `template` is Angular state so
      // it should be lowercase, with dashes
      // This is the bridge towards (and from) React
      template: '<admin-audit-log></admin-audit-log>',
      requiresRole: 'admin',
      requiresAuth: true,
      footerHidden: true,
      data: {
        pageTitle: 'Admin - Audit log',
      },
    })
    .state('admin-acquisition-stories', {
      url: '/admin/acquisition-stories',
      // `template` is Angular state so
      // it should be lowercase, with dashes
      // This is the bridge towards (and from) React
      template: '<admin-acquisition-stories></admin-acquisition-stories>',
      requiresRole: 'admin',
      requiresAuth: true,
      footerHidden: true,
      data: {
        pageTitle: 'Admin - Acquisition stories',
      },
    })
    .state('admin-messages', {
      url: '/admin/messages',
      // `template` is Angular state so
      // it should be lowercase, with dashes
      // This is the bridge towards (and from) React
      template: '<admin-messages></admin-messages>',
      requiresRole: 'admin',
      requiresAuth: true,
      footerHidden: true,
      data: {
        pageTitle: 'Admin - Messages',
      },
    })
    .state('admin-threads', {
      url: '/admin/threads',
      // `template` is Angular state so
      // it should be lowercase, with dashes
      // This is the bridge towards (and from) React
      template: '<admin-threads></admin-threads>',
      requiresRole: 'admin',
      requiresAuth: true,
      footerHidden: true,
      data: {
        pageTitle: 'Admin - Threads',
      },
    })
    .state('admin-search-users', {
      url: '/admin/search-users',
      // `template` is Angular state so
      // it should be lowercase, with dashes
      // This is the bridge towards (and from) React
      template: '<admin-search-users></admin-search-users>',
      requiresRole: 'admin',
      requiresAuth: true,
      footerHidden: true,
      data: {
        pageTitle: 'Admin - Search users',
      },
    })
    .state('admin-user', {
      url: '/admin/user',
      // `template` is Angular state so
      // it should be lowercase, with dashes
      // This is the bridge towards (and from) React
      template: '<admin-user></admin-user>',
      requiresRole: 'admin',
      requiresAuth: true,
      footerHidden: true,
      data: {
        pageTitle: 'Admin - User',
      },
    });
}
