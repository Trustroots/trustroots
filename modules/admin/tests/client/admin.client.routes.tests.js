import '@/modules/admin/client/admin.client.module';
import AppConfig from '@/modules/core/client/app/config';

describe('Admin Route Tests', function () {
  let $state;

  beforeEach(angular.mock.module(AppConfig.appModuleName));

  beforeEach(inject(function (_$state_) {
    $state = _$state_;
  }));

  const adminStates = [
    {
      name: 'admin',
      url: '/admin',
      template: '<admin></admin>',
      requiresAuth: true,
      requiresRole: 'admin',
      footerHidden: true,
      pageTitle: 'Admin',
    },
    {
      name: 'admin-audit-log',
      url: '/admin/audit-log',
      template: '<admin-audit-log></admin-audit-log>',
      requiresAuth: true,
      requiresRole: 'admin',
      footerHidden: true,
      pageTitle: 'Admin - Audit log',
    },
    {
      name: 'admin-acquisition-stories',
      url: '/admin/acquisition-stories',
      template: '<admin-acquisition-stories></admin-acquisition-stories>',
      requiresAuth: true,
      requiresRole: 'admin',
      footerHidden: true,
      pageTitle: 'Admin - Acquisition stories',
    },
    {
      name: 'admin-acquisition-stories-analysis',
      url: '/admin/acquisition-stories/analysis',
      template:
        '<admin-acquisition-stories-analysis></admin-acquisition-stories-analysis>',
      requiresAuth: true,
      requiresRole: 'admin',
      footerHidden: true,
      pageTitle: 'Admin - Acquisition stories analysis',
    },
    {
      name: 'admin-messages',
      url: '/admin/messages',
      template: '<admin-messages></admin-messages>',
      requiresAuth: true,
      requiresRole: 'admin',
      footerHidden: true,
      pageTitle: 'Admin - Messages',
    },
    {
      name: 'admin-threads',
      url: '/admin/threads',
      template: '<admin-threads></admin-threads>',
      requiresAuth: true,
      requiresRole: 'admin',
      footerHidden: true,
      pageTitle: 'Admin - Threads',
    },
    {
      name: 'admin-search-users',
      url: '/admin/search-users',
      template: '<admin-search-users></admin-search-users>',
      requiresAuth: true,
      requiresRole: 'admin',
      footerHidden: true,
      pageTitle: 'Admin - Search users',
    },
    {
      name: 'admin-user',
      url: '/admin/user',
      template: '<admin-user></admin-user>',
      requiresAuth: true,
      requiresRole: 'admin',
      footerHidden: true,
      pageTitle: 'Admin - User',
    },
    {
      name: 'admin-reference-threads',
      url: '/admin/reference-threads',
      template: '<admin-reference-threads></admin-reference-threads>',
      requiresAuth: true,
      requiresRole: 'admin',
      footerHidden: true,
      pageTitle: 'Admin - Reference threads',
    },
    {
      name: 'admin-newsletter',
      url: '/admin/newsletter',
      template: '<admin-newsletter></admin-newsletter>',
      requiresAuth: true,
      requiresRole: 'admin',
      footerHidden: true,
      pageTitle: 'Admin - Newsletter',
    },
  ];

  adminStates.forEach(
    ({
      name,
      url,
      template,
      requiresAuth,
      requiresRole,
      footerHidden,
      pageTitle,
    }) => {
      it(`configures ${name}`, function () {
        const state = $state.get(name);
        expect(state).toBeDefined();
        expect(state.url).toBe(url);
        expect(state.template).toBe(template);
        expect(state.requiresAuth).toBe(requiresAuth);
        expect(state.requiresRole).toBe(requiresRole);
        expect(state.footerHidden).toBe(footerHidden);
        expect(state.data).toMatchObject({ pageTitle });
      });
    },
  );
});
