const assert = require('assert');
const proxyquire = require('proxyquire').noCallThru();

function handler(name) {
  const fn = (req, res, next) => {
    if (next) {
      next();
    }
  };
  fn.routeTestName = name;
  return fn;
}

function controller(methods, prefix) {
  return methods.reduce((stubs, method) => {
    stubs[method] = handler(`${prefix}.${method}`);
    return stubs;
  }, {});
}

function createAppRecorder() {
  const routes = [];
  const params = [];

  return {
    app: {
      route(path) {
        const route = {
          path,
          all: [],
          delete: [],
          get: [],
          post: [],
          put: [],
        };
        routes.push(route);

        return ['all', 'delete', 'get', 'post', 'put'].reduce(
          (chain, method) => {
            chain[method] = (...handlers) => {
              route[method].push(...handlers);
              return chain;
            };
            return chain;
          },
          {},
        );
      },
      param(name, middleware) {
        params.push({ name, middleware });
      },
    },
    params,
    routes,
  };
}

function routeByPath(routes, path) {
  const route = routes.find(candidate => candidate.path === path);
  assert(route, `Expected route ${path} to be registered`);
  return route;
}

function assertHandlers(actual, expected, label) {
  assert.deepStrictEqual(
    actual.map(fn => fn.routeTestName),
    expected.map(fn => fn.routeTestName),
    label,
  );
}

function assertPolicy(route, policy) {
  assertHandlers(route.all, [policy.isAllowed], `${route.path} policy`);
}

function register(modulePath, stubs) {
  const { app, params, routes } = createAppRecorder();
  proxyquire(modulePath, stubs)(app);
  return { params, routes };
}

describe('API route registrations', () => {
  it('registers contacts routes with policy middleware and params', () => {
    const policy = { isAllowed: handler('contactsPolicy.isAllowed') };
    const contacts = controller(
      [
        'add',
        'confirm',
        'contactById',
        'contactByUserId',
        'contactListByUser',
        'filterByCommon',
        'get',
        'list',
        'remove',
      ],
      'contacts',
    );

    const { params, routes } = register(
      '../../../../modules/contacts/server/routes/contacts.server.routes',
      {
        '../controllers/contacts.server.controller': contacts,
        '../policies/contacts.server.policy': policy,
      },
    );

    assertHandlers(routeByPath(routes, '/api/contact').post, [contacts.add]);
    assertHandlers(routeByPath(routes, '/api/contact-by/:contactUserId').get, [
      contacts.get,
    ]);
    assertHandlers(routeByPath(routes, '/api/contact/:contactId').get, [
      contacts.get,
    ]);
    assertHandlers(routeByPath(routes, '/api/contact/:contactId').put, [
      contacts.confirm,
    ]);
    assertHandlers(routeByPath(routes, '/api/contact/:contactId').delete, [
      contacts.remove,
    ]);
    assertHandlers(routeByPath(routes, '/api/contacts/:listUserId').get, [
      contacts.list,
    ]);
    assertHandlers(
      routeByPath(routes, '/api/contacts/:listUserId/common').get,
      [contacts.filterByCommon, contacts.list],
    );
    routes.forEach(route => assertPolicy(route, policy));
    assert.deepStrictEqual(
      params.map(param => [param.name, param.middleware.routeTestName]),
      [
        ['listUserId', 'contacts.contactListByUser'],
        ['contactId', 'contacts.contactById'],
        ['contactUserId', 'contacts.contactByUserId'],
      ],
    );
  });

  it('registers messages routes with inbox, thread, counters, and sync handlers', () => {
    const policy = { isAllowed: handler('messagesPolicy.isAllowed') };
    const messages = controller(
      [
        'inbox',
        'markRead',
        'messagesCount',
        'send',
        'sync',
        'thread',
        'threadByUser',
      ],
      'messages',
    );

    const { params, routes } = register(
      '../../../../modules/messages/server/routes/messages.server.routes',
      {
        '../controllers/messages.server.controller': messages,
        '../policies/messages.server.policy': policy,
      },
    );

    assertHandlers(routeByPath(routes, '/api/messages').get, [messages.inbox]);
    assertHandlers(routeByPath(routes, '/api/messages').post, [messages.send]);
    assertHandlers(routeByPath(routes, '/api/messages/:messageUserId').get, [
      messages.thread,
    ]);
    assertHandlers(routeByPath(routes, '/api/messages-read').post, [
      messages.markRead,
    ]);
    assertHandlers(routeByPath(routes, '/api/messages-count').get, [
      messages.messagesCount,
    ]);
    assertHandlers(routeByPath(routes, '/api/messages-sync').get, [
      messages.sync,
    ]);
    routes.forEach(route => assertPolicy(route, policy));
    assert.deepStrictEqual(
      params.map(param => [param.name, param.middleware.routeTestName]),
      [['messageUserId', 'messages.threadByUser']],
    );
  });

  it('registers offers routes with list, create, read, update, delete, and params', () => {
    const policy = { isAllowed: handler('offersPolicy.isAllowed') };
    const offers = controller(
      [
        'create',
        'delete',
        'getOffer',
        'list',
        'listOffersByUser',
        'offerById',
        'offersByUserId',
        'update',
      ],
      'offers',
    );

    const { params, routes } = register(
      '../../../../modules/offers/server/routes/offers.server.routes',
      {
        '../controllers/offers.server.controller': offers,
        '../policies/offers.server.policy': policy,
      },
    );

    assertHandlers(routeByPath(routes, '/api/offers-by/:offerUserId').get, [
      offers.listOffersByUser,
    ]);
    assertHandlers(routeByPath(routes, '/api/offers').get, [offers.list]);
    assertHandlers(routeByPath(routes, '/api/offers').post, [offers.create]);
    assertHandlers(routeByPath(routes, '/api/offers/:offerId').get, [
      offers.getOffer,
    ]);
    assertHandlers(routeByPath(routes, '/api/offers/:offerId').delete, [
      offers.delete,
    ]);
    assertHandlers(routeByPath(routes, '/api/offers/:offerId').put, [
      offers.update,
    ]);
    routes.forEach(route => assertPolicy(route, policy));
    assert.deepStrictEqual(
      params.map(param => [param.name, param.middleware.routeTestName]),
      [
        ['offerUserId', 'offers.offersByUserId'],
        ['offerId', 'offers.offerById'],
      ],
    );
  });

  it('registers reference thread routes and user lookup param', () => {
    const policy = { isAllowed: handler('referenceThreadPolicy.isAllowed') };
    const referenceThread = controller(
      [
        'createReferenceThread',
        'readReferenceThread',
        'readReferenceThreadById',
      ],
      'referenceThread',
    );

    const { params, routes } = register(
      '../../../../modules/references-thread/server/routes/reference-thread.server.routes',
      {
        '../controllers/reference-thread.server.controller': referenceThread,
        '../policies/reference-thread.server.policy': policy,
      },
    );

    assertHandlers(
      routeByPath(routes, '/api/references-thread/:referenceThreadUserToId')
        .get,
      [referenceThread.readReferenceThread],
    );
    assertHandlers(routeByPath(routes, '/api/references-thread').post, [
      referenceThread.createReferenceThread,
    ]);
    routes.forEach(route => assertPolicy(route, policy));
    assert.deepStrictEqual(
      params.map(param => [param.name, param.middleware.routeTestName]),
      [['referenceThreadUserToId', 'referenceThread.readReferenceThreadById']],
    );
  });

  it('registers tribes and support routes', () => {
    const tribesPolicy = { isAllowed: handler('tribesPolicy.isAllowed') };
    const tribes = controller(
      ['getTribe', 'listTribes', 'tribeBySlug'],
      'tribes',
    );
    const support = controller(['supportRequest'], 'support');

    const tribeRoutes = register(
      '../../../../modules/tribes/server/routes/tribes.server.routes',
      {
        '../controllers/tribes.server.controller': tribes,
        '../policies/tribes.server.policy': tribesPolicy,
      },
    );
    const supportRoutes = register(
      '../../../../modules/support/server/routes/support.server.routes',
      {
        '../controllers/support.server.controller': support,
      },
    );

    assertHandlers(routeByPath(tribeRoutes.routes, '/api/tribes').get, [
      tribes.listTribes,
    ]);
    assertHandlers(routeByPath(tribeRoutes.routes, '/api/tribes/:tribe').get, [
      tribes.getTribe,
    ]);
    tribeRoutes.routes.forEach(route => assertPolicy(route, tribesPolicy));
    assert.deepStrictEqual(
      tribeRoutes.params.map(param => [
        param.name,
        param.middleware.routeTestName,
      ]),
      [['tribe', 'tribes.tribeBySlug']],
    );
    assertHandlers(routeByPath(supportRoutes.routes, '/api/support').post, [
      support.supportRequest,
    ]);
  });

  it('registers users profile, avatar, memberships, push, and password routes', () => {
    const policy = { isAllowed: handler('usersPolicy.isAllowed') };
    const profile = controller(
      [
        'addPushRegistration',
        'getMiniUser',
        'getUser',
        'getUserMemberships',
        'initializeRemoveProfile',
        'joinTribe',
        'leaveTribe',
        'removeProfile',
        'removePushRegistration',
        'search',
        'update',
        'userByUsername',
        'userMiniByID',
      ],
      'userProfile',
    );
    const avatar = controller(
      [
        'avatarUpload',
        'avatarUploadField',
        'getAvatar',
        'userForAvatarByUserId',
      ],
      'userAvatar',
    );
    const password = controller(['changePassword'], 'userPassword');
    const authentication = controller(
      ['removeOAuthProvider'],
      'userAuthentication',
    );

    const { params, routes } = register(
      '../../../../modules/users/server/routes/users.server.routes',
      {
        '../controllers/users.authentication.server.controller': authentication,
        '../controllers/users.avatar.server.controller': avatar,
        '../controllers/users.password.server.controller': password,
        '../controllers/users.profile.server.controller': profile,
        '../policies/users.server.policy': policy,
      },
    );

    assertHandlers(routeByPath(routes, '/api/users').get, [profile.search]);
    assertHandlers(routeByPath(routes, '/api/users').delete, [
      profile.initializeRemoveProfile,
    ]);
    assertHandlers(routeByPath(routes, '/api/users').put, [profile.update]);
    assertHandlers(routeByPath(routes, '/api/users/remove/:token').delete, [
      profile.removeProfile,
    ]);
    assertHandlers(routeByPath(routes, '/api/users-avatar').post, [
      avatar.avatarUploadField,
      avatar.avatarUpload,
    ]);
    assertHandlers(routeByPath(routes, '/api/users/:avatarUserId/avatar').get, [
      avatar.getAvatar,
    ]);
    assertHandlers(routeByPath(routes, '/api/users/memberships').get, [
      profile.getUserMemberships,
    ]);
    assertHandlers(
      routeByPath(routes, '/api/users/memberships/:tribeId').post,
      [profile.joinTribe],
    );
    assertHandlers(
      routeByPath(routes, '/api/users/memberships/:tribeId').delete,
      [profile.leaveTribe],
    );
    assertHandlers(routeByPath(routes, '/api/users/push/registrations').post, [
      profile.addPushRegistration,
    ]);
    assertHandlers(
      routeByPath(routes, '/api/users/push/registrations/:token').delete,
      [profile.removePushRegistration],
    );
    assertHandlers(routeByPath(routes, '/api/users/mini/:userId').get, [
      profile.getMiniUser,
    ]);
    assertHandlers(
      routeByPath(routes, '/api/users/accounts/:provider').delete,
      [authentication.removeOAuthProvider],
    );
    assertHandlers(routeByPath(routes, '/api/users/password').post, [
      password.changePassword,
    ]);
    assertHandlers(routeByPath(routes, '/api/users/:username').get, [
      profile.getUser,
    ]);
    routes
      .filter(route => route.path !== '/api/users/accounts/:provider')
      .filter(route => route.path !== '/api/users/password')
      .forEach(route => assertPolicy(route, policy));
    assert.deepStrictEqual(
      params.map(param => [param.name, param.middleware.routeTestName]),
      [
        ['userId', 'userProfile.userMiniByID'],
        ['username', 'userProfile.userByUsername'],
        ['avatarUserId', 'userAvatar.userForAvatarByUserId'],
      ],
    );
  });

  it('registers authentication routes and OAuth passport middleware', () => {
    const policy = { isAllowed: handler('usersPolicy.isAllowed') };
    const authentication = controller(
      [
        'confirmEmail',
        'oauthCallback',
        'resendConfirmation',
        'signin',
        'signout',
        'signup',
        'signupValidation',
        'updateFacebookOAuthToken',
        'validateEmailToken',
      ],
      'userAuthentication',
    );
    authentication.oauthCallback = provider =>
      handler(`userAuthentication.oauthCallback.${provider}`);
    const password = controller(
      ['forgot', 'reset', 'validateResetToken'],
      'userPassword',
    );
    const passportAuthenticateCalls = [];
    const passport = {
      authenticate(provider, options) {
        passportAuthenticateCalls.push({ provider, options });
        return handler(`passport.authenticate.${provider}`);
      },
    };

    const { routes } = register(
      '../../../../modules/users/server/routes/auth.server.routes',
      {
        '../controllers/users.authentication.server.controller': authentication,
        '../controllers/users.password.server.controller': password,
        '../policies/users.server.policy': policy,
        passport,
      },
    );

    assertHandlers(routeByPath(routes, '/api/auth/confirm-email/:token').get, [
      authentication.validateEmailToken,
    ]);
    assertHandlers(routeByPath(routes, '/api/auth/confirm-email/:token').post, [
      authentication.confirmEmail,
    ]);
    assertHandlers(routeByPath(routes, '/api/auth/resend-confirmation').post, [
      authentication.resendConfirmation,
    ]);
    assertHandlers(routeByPath(routes, '/api/auth/forgot').post, [
      password.forgot,
    ]);
    assertHandlers(routeByPath(routes, '/api/auth/reset/:token').get, [
      password.validateResetToken,
    ]);
    assertHandlers(routeByPath(routes, '/api/auth/reset/:token').post, [
      password.reset,
    ]);
    assertHandlers(routeByPath(routes, '/api/auth/signup').post, [
      authentication.signup,
    ]);
    assertHandlers(routeByPath(routes, '/api/auth/signup/validate').post, [
      authentication.signupValidation,
    ]);
    assertHandlers(routeByPath(routes, '/api/auth/signin').post, [
      authentication.signin,
    ]);
    assertHandlers(routeByPath(routes, '/api/auth/signout').get, [
      authentication.signout,
    ]);
    assertHandlers(routeByPath(routes, '/api/auth/facebook').get, [
      passportAuthenticateCalls[0] &&
        handler(
          `passport.authenticate.${passportAuthenticateCalls[0].provider}`,
        ),
    ]);
    assertHandlers(routeByPath(routes, '/api/auth/facebook').put, [
      authentication.updateFacebookOAuthToken,
    ]);
    assertHandlers(routeByPath(routes, '/api/auth/facebook/callback').get, [
      handler('userAuthentication.oauthCallback.facebook'),
    ]);
    assertHandlers(routeByPath(routes, '/api/auth/twitter').get, [
      handler('passport.authenticate.twitter'),
    ]);
    assertHandlers(routeByPath(routes, '/api/auth/twitter/callback').get, [
      handler('userAuthentication.oauthCallback.twitter'),
    ]);
    assertHandlers(routeByPath(routes, '/api/auth/github').get, [
      handler('passport.authenticate.github'),
    ]);
    assertHandlers(routeByPath(routes, '/api/auth/github/callback').get, [
      handler('userAuthentication.oauthCallback.github'),
    ]);
    routes
      .filter(route => /facebook|twitter|github/.test(route.path))
      .forEach(route => assertPolicy(route, policy));
    assert.deepStrictEqual(passportAuthenticateCalls, [
      { provider: 'facebook', options: { scope: ['public_profile', 'email'] } },
      { provider: 'twitter', options: undefined },
      { provider: 'github', options: { scope: ['user:email'] } },
    ]);
  });

  it('registers blocked-user routes', () => {
    const policy = { isAllowed: handler('usersPolicy.isAllowed') };
    const block = controller(
      ['blockUser', 'getBlockedUsers', 'unblockUser'],
      'userBlock',
    );

    const { routes } = register(
      '../../../../modules/users/server/routes/users-block.server.routes',
      {
        '../controllers/users.block.server.controller': block,
        '../policies/users.server.policy': policy,
      },
    );

    assertHandlers(routeByPath(routes, '/api/blocked-users').get, [
      block.getBlockedUsers,
    ]);
    assertHandlers(routeByPath(routes, '/api/blocked-users/:username').put, [
      block.blockUser,
    ]);
    assertHandlers(routeByPath(routes, '/api/blocked-users/:username').delete, [
      block.unblockUser,
    ]);
    routes.forEach(route => assertPolicy(route, policy));
  });

  it('registers admin routes with audit log middleware where required', () => {
    const policy = { isAllowed: handler('adminPolicy.isAllowed') };
    const acquisitionStories = controller(
      ['getAnalysis', 'list'],
      'adminAcquisitionStories',
    );
    const auditLog = controller(['list', 'record'], 'adminAuditLog');
    const messages = controller(['getMessages'], 'adminMessages');
    const notes = controller(['addNote', 'getNotes'], 'adminNotes');
    const referenceThreads = controller(['list'], 'adminReferenceThreads');
    const threads = controller(['getThreads'], 'adminThreads');
    const users = controller(
      [
        'changeRole',
        'getUser',
        'listUsersByRole',
        'searchUsers',
        'usernameToUserId',
      ],
      'adminUsers',
    );

    const { routes } = register(
      '../../../../modules/admin/server/routes/admin.server.routes',
      {
        '../controllers/admin.acquisition-stories.server.controller':
          acquisitionStories,
        '../controllers/admin.audit-log.server.controller': auditLog,
        '../controllers/admin.messages.server.controller': messages,
        '../controllers/admin.notes.server.controller': notes,
        '../controllers/admin.reference-threads.server.controller':
          referenceThreads,
        '../controllers/admin.threads.server.controller': threads,
        '../controllers/admin.users.server.controller': users,
        '../policies/admin.server.policy': policy,
      },
    );

    assertHandlers(routeByPath(routes, '/api/admin/acquisition-stories').post, [
      auditLog.record,
      acquisitionStories.list,
    ]);
    assertHandlers(
      routeByPath(routes, '/api/admin/acquisition-stories/analysis').post,
      [auditLog.record, acquisitionStories.getAnalysis],
    );
    assertHandlers(routeByPath(routes, '/api/admin/audit-log').get, [
      auditLog.list,
    ]);
    assertHandlers(routeByPath(routes, '/api/admin/messages').post, [
      auditLog.record,
      messages.getMessages,
    ]);
    assertHandlers(routeByPath(routes, '/api/admin/threads').post, [
      auditLog.record,
      users.usernameToUserId,
      threads.getThreads,
    ]);
    assertHandlers(routeByPath(routes, '/api/admin/notes').get, [
      auditLog.record,
      notes.getNotes,
    ]);
    assertHandlers(routeByPath(routes, '/api/admin/notes').post, [
      auditLog.record,
      notes.addNote,
    ]);
    assertHandlers(routeByPath(routes, '/api/admin/users').post, [
      auditLog.record,
      users.searchUsers,
    ]);
    assertHandlers(routeByPath(routes, '/api/admin/users/by-role').post, [
      auditLog.record,
      users.listUsersByRole,
    ]);
    assertHandlers(routeByPath(routes, '/api/admin/user').post, [
      auditLog.record,
      users.getUser,
    ]);
    assertHandlers(routeByPath(routes, '/api/admin/user/change-role').post, [
      auditLog.record,
      users.changeRole,
    ]);
    assertHandlers(routeByPath(routes, '/api/admin/reference-threads').get, [
      auditLog.record,
      referenceThreads.list,
    ]);
    routes.forEach(route => assertPolicy(route, policy));
  });

  it('registers simple integration routes for pages, statistics, and SparkPost', () => {
    const volunteers = controller(['list'], 'volunteers');
    const statistics = controller(
      ['collectStatistics', 'getPublicStatistics'],
      'statistics',
    );
    const sparkpost = controller(
      ['basicAuthenticate', 'receiveBatch'],
      'sparkpost',
    );

    const pagesRoutes = register(
      '../../../../modules/pages/server/routes/admin.server.routes',
      {
        '../controllers/pages.volunteers.server.controller': volunteers,
      },
    );
    const statisticsRoutes = register(
      '../../../../modules/statistics/server/routes/statistics.server.routes',
      {
        '../controllers/statistics.server.controller': statistics,
      },
    );
    const sparkpostRoutes = register(
      '../../../../modules/sparkpost/server/routes/sparkpost.server.routes',
      {
        '../controllers/sparkpost-webhooks.server.controller': sparkpost,
      },
    );

    assertHandlers(routeByPath(pagesRoutes.routes, '/api/volunteers').get, [
      volunteers.list,
    ]);
    assertHandlers(
      routeByPath(statisticsRoutes.routes, '/api/statistics').post,
      [statistics.collectStatistics],
    );
    assertHandlers(
      routeByPath(statisticsRoutes.routes, '/api/statistics').get,
      [statistics.getPublicStatistics],
    );
    assertHandlers(
      routeByPath(sparkpostRoutes.routes, '/api/sparkpost/webhook').post,
      [sparkpost.basicAuthenticate, sparkpost.receiveBatch],
    );
  });
});
