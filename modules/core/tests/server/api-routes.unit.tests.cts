const assert: typeof import('node:assert') = require('assert');
const { createRequire }: typeof import('node:module') = require('node:module');
const sinon: typeof import('sinon') = require('sinon');
const proxyquire: typeof import('../../../../testutils/server/mock-module.mts').default = require('./../../../../testutils/server/mock-module');

type NamedHandler = ((
  req: unknown,
  res: unknown,
  next?: () => void,
) => void) & {
  routeTestName?: string;
};
type HttpMethod = 'all' | 'delete' | 'get' | 'post' | 'put' | 'patch';
type RecordedRoute = { path: string } & Record<HttpMethod, NamedHandler[]>;
type RouteChain = Record<
  HttpMethod,
  (...handlers: NamedHandler[]) => RouteChain
>;
interface RecorderApp {
  route(path: string): RouteChain;
  param(name: string, middleware: NamedHandler): void;
}
interface Recorder {
  app: RecorderApp;
  params: Array<{ name: string; middleware: NamedHandler }>;
  routes: RecordedRoute[];
}
type RouteRegistrar = (app: RecorderApp) => void;
type DependencyReplacements = Record<string, NamedHandler>;

function handler(name: string): NamedHandler {
  const fn: NamedHandler = (req, res, next) => {
    if (next) {
      next();
    }
  };
  fn.routeTestName = name;
  return fn;
}

function controller<const T extends string>(
  methods: readonly T[],
  prefix: string,
): Record<T, NamedHandler> {
  return methods.reduce(
    (stubs, method) => {
      stubs[method] = handler(`${prefix}.${method}`);
      return stubs;
    },
    {} as Record<T, NamedHandler>,
  );
}

function createAppRecorder(): Recorder {
  const routes: RecordedRoute[] = [];
  const params: Recorder['params'] = [];

  return {
    app: {
      route(path) {
        const route: RecordedRoute = {
          path,
          all: [],
          delete: [],
          get: [],
          post: [],
          put: [],
          patch: [],
        };
        routes.push(route);

        return (
          ['all', 'delete', 'get', 'post', 'put', 'patch'] as const
        ).reduce((chain, method) => {
          chain[method] = (...handlers) => {
            route[method].push(...handlers);
            return chain;
          };
          return chain;
        }, {} as RouteChain);
      },
      param(name, middleware) {
        params.push({ name, middleware });
      },
    },
    params,
    routes,
  };
}

function routeByPath(routes: RecordedRoute[], path: string): RecordedRoute {
  const route = routes.find(candidate => candidate.path === path);
  assert(route, `Expected route ${path} to be registered`);
  return route;
}

function assertHandlers(
  actual: NamedHandler[],
  expected: NamedHandler[],
  label?: string,
) {
  const actualNames = actual.map(fn => fn.routeTestName);
  const expectedNames = expected.map(fn => fn.routeTestName);
  if (label === undefined) {
    assert.deepStrictEqual(actualNames, expectedNames);
  } else {
    assert.deepStrictEqual(actualNames, expectedNames, label);
  }
}

function assertPolicy(
  route: RecordedRoute,
  policy: { isAllowed: NamedHandler },
) {
  assertHandlers(route.all, [policy.isAllowed], `${route.path} policy`);
}

function register(
  modulePath: string,
  stubs: Record<string, DependencyReplacements>,
) {
  const { app, params, routes } = createAppRecorder();
  const file = require.resolve(modulePath);
  const esmExtension = ['.mjs', '.mts'].find(ext => file.endsWith(ext));
  if (esmExtension) {
    const sandbox = sinon.createSandbox();
    const dependencyRequire = createRequire(file);
    try {
      for (const [specifier, replacements] of Object.entries(stubs)) {
        let dependencyPath;
        for (const extension of ['.mjs', '.mts']) {
          try {
            dependencyPath = dependencyRequire.resolve(specifier + extension);
            break;
          } catch (error) {
            if (
              typeof error !== 'object' ||
              error === null ||
              !('code' in error) ||
              error.code !== 'MODULE_NOT_FOUND'
            ) {
              throw error;
            }
          }
        }
        if (!dependencyPath) {
          throw new Error(`Could not resolve route dependency: ${specifier}`);
        }
        const dependency: DependencyReplacements =
          dependencyRequire(dependencyPath);
        for (const [name, value] of Object.entries(replacements)) {
          if (typeof value === 'function') {
            const replacement = sandbox
              .stub(dependency, name)
              .callsFake(value) as import('sinon').SinonStub &
              Pick<NamedHandler, 'routeTestName'>;
            replacement.routeTestName = value.routeTestName;
          } else {
            sandbox.stub(dependency, name).value(value);
          }
        }
      }
      const registerRoutes: RouteRegistrar = require(file);
      registerRoutes(app);
    } finally {
      sandbox.restore();
    }
  } else {
    proxyquire<RouteRegistrar>(modulePath, stubs)(app);
  }
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
      './../../../contacts/server/routes/contacts.server.routes.mjs',
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
      './../../../messages/server/routes/messages.server.routes.mjs',
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
      './../../../offers/server/routes/offers.server.routes.mjs',
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
      './../../../references-thread/server/routes/reference-thread.server.routes.mjs',
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
    const supportLimit = { support: handler('requestLimit.support') };

    const tribeRoutes = register(
      './../../../tribes/server/routes/tribes.server.routes.mjs',
      {
        '../controllers/tribes.server.controller': tribes,
        '../policies/tribes.server.policy': tribesPolicy,
      },
    );
    const supportRoutes = register(
      './../../../support/server/routes/support.server.routes.mjs',
      {
        '../controllers/support.server.controller': support,
        '../../../core/server/middleware/targeted-request-limit.server.middleware':
          supportLimit,
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
      supportLimit.support,
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
    const targetedRequestLimit = controller(['avatarUpload'], 'requestLimit');

    const { params, routes } = register(
      './../../../users/server/routes/users.server.routes.mts',
      {
        '../controllers/users.authentication.server.controller': authentication,
        '../controllers/users.avatar.server.controller': avatar,
        '../controllers/users.password.server.controller': password,
        '../controllers/users.profile.server.controller': profile,
        '../policies/users.server.policy': policy,
        '../../../core/server/middleware/targeted-request-limit.server.middleware':
          targetedRequestLimit,
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
      targetedRequestLimit.avatarUpload,
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
    routes.forEach(route => assertPolicy(route, policy));
    assert.deepStrictEqual(
      params.map(param => [param.name, param.middleware.routeTestName]),
      [
        ['userId', 'userProfile.userMiniByID'],
        ['username', 'userProfile.userByUsername'],
        ['avatarUserId', 'userAvatar.userForAvatarByUserId'],
      ],
    );
  });

  it('registers local authentication routes without social OAuth', () => {
    const authentication = controller(
      [
        'confirmEmail',
        'resendConfirmation',
        'signin',
        'signout',
        'signup',
        'signupValidation',
        'validateEmailToken',
      ],
      'userAuthentication',
    );
    const password = controller(
      ['forgot', 'reset', 'validateResetToken'],
      'userPassword',
    );
    const targetedRequestLimit = controller(
      [
        'resendConfirmation',
        'forgotPassword',
        'resetPassword',
        'signin',
        'signup',
      ],
      'requestLimit',
    );

    const { routes } = register(
      './../../../users/server/routes/auth.server.routes.mts',
      {
        '../controllers/users.authentication.server.controller': authentication,
        '../controllers/users.password.server.controller': password,
        '../../../core/server/middleware/targeted-request-limit.server.middleware':
          targetedRequestLimit,
      },
    );

    assertHandlers(routeByPath(routes, '/api/auth/confirm-email/:token').get, [
      authentication.validateEmailToken,
    ]);
    assertHandlers(routeByPath(routes, '/api/auth/confirm-email/:token').post, [
      authentication.confirmEmail,
    ]);
    assertHandlers(routeByPath(routes, '/api/auth/resend-confirmation').post, [
      targetedRequestLimit.resendConfirmation,
      authentication.resendConfirmation,
    ]);
    assertHandlers(routeByPath(routes, '/api/auth/forgot').post, [
      targetedRequestLimit.forgotPassword,
      password.forgot,
    ]);
    assertHandlers(routeByPath(routes, '/api/auth/reset/:token').get, [
      password.validateResetToken,
    ]);
    assertHandlers(routeByPath(routes, '/api/auth/reset/:token').post, [
      targetedRequestLimit.resetPassword,
      password.reset,
    ]);
    assertHandlers(routeByPath(routes, '/api/auth/signup').post, [
      targetedRequestLimit.signup,
      authentication.signup,
    ]);
    assertHandlers(routeByPath(routes, '/api/auth/signup/validate').post, [
      authentication.signupValidation,
    ]);
    assertHandlers(routeByPath(routes, '/api/auth/signin').post, [
      targetedRequestLimit.signin,
      authentication.signin,
    ]);
    const signoutRoute = routeByPath(routes, '/api/auth/signout');
    let getSignoutStatus: number | undefined;
    signoutRoute.get[0](
      {},
      {
        sendStatus(status: number) {
          getSignoutStatus = status;
        },
      },
    );
    assert.equal(getSignoutStatus, 405);
    assertHandlers(signoutRoute.post, [authentication.signout]);
    assert.equal(
      routes.some(route => /\/api\/auth\/(facebook|github)/.test(route.path)),
      false,
    );
  });

  it('registers blocked-user routes', () => {
    const policy = { isAllowed: handler('usersPolicy.isAllowed') };
    const block = controller(
      ['blockUser', 'getBlockedUsers', 'unblockUser'],
      'userBlock',
    );

    const { routes } = register(
      './../../../users/server/routes/users-block.server.routes.mts',
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
    const support = controller(
      [
        'list',
        'detail',
        'setStatus',
        'investigation',
        'searchMembers',
        'member',
      ],
      'support',
    );
    const acquisitionStories = controller(['list'], 'adminAcquisitionStories');
    const auditLog = controller(['list', 'record', 'actors'], 'adminAuditLog');
    const locationCorrections = controller(
      ['list', 'send'],
      'adminLocationCorrections',
    );
    const messages = controller(['getMessages'], 'adminMessages');
    const newsletter = controller(
      [
        'audience',
        'list',
        'listCircleMembers',
        'splitSubscribers',
        'uploadSubscribersCsv',
      ],
      'adminNewsletter',
    );
    const notes = controller(['addNote', 'getNotes'], 'adminNotes');
    const referenceThreads = controller(['list'], 'adminReferenceThreads');
    const threads = controller(['getThreads'], 'adminThreads');
    const users = controller(
      [
        'changeRole',
        'getUser',
        'listUsersByLastIpAddress',
        'listUsersByRole',
        'searchUsers',
        'usernameToUserId',
      ],
      'adminUsers',
    );

    const { routes } = register(
      './../../../admin/server/routes/admin.server.routes.mjs',
      {
        '../controllers/admin.support.server.controller': support,
        '../controllers/admin.acquisition-stories.server.controller':
          acquisitionStories,
        '../controllers/admin.audit-log.server.controller': auditLog,
        '../controllers/admin.location-corrections.server.controller':
          locationCorrections,
        '../controllers/admin.messages.server.controller': messages,
        '../controllers/admin.newsletter.server.controller': newsletter,
        '../controllers/admin.notes.server.controller': notes,
        '../controllers/admin.reference-threads.server.controller':
          referenceThreads,
        '../controllers/admin.threads.server.controller': threads,
        '../controllers/admin.users.server.controller': users,
        '../policies/admin.server.policy': policy,
      },
    );

    assertHandlers(routeByPath(routes, '/api/admin/support').get, [
      support.list,
    ]);
    assertHandlers(routeByPath(routes, '/api/admin/support/:requestId').patch, [
      support.setStatus,
    ]);
    assertHandlers(
      routeByPath(routes, '/api/admin/support/:requestId/:kind').get,
      [support.investigation],
    );
    assertHandlers(routeByPath(routes, '/api/admin/location-corrections').get, [
      auditLog.record,
      locationCorrections.list,
    ]);
    assertHandlers(
      routeByPath(routes, '/api/admin/location-corrections/send').post,
      [auditLog.record, locationCorrections.send],
    );
    assertHandlers(routeByPath(routes, '/api/admin/acquisition-stories').post, [
      auditLog.record,
      acquisitionStories.list,
    ]);
    assert.strictEqual(
      routes.some(
        route => route.path === '/api/admin/acquisition-stories/analysis',
      ),
      false,
    );
    assertHandlers(routeByPath(routes, '/api/admin/audit-log').get, [
      auditLog.list,
    ]);
    assertHandlers(routeByPath(routes, '/api/admin/audit-log/actors').get, [
      auditLog.actors,
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
    assertHandlers(
      routeByPath(routes, '/api/admin/users/by-last-ip-address').post,
      [auditLog.record, users.listUsersByLastIpAddress],
    );
    assertHandlers(routeByPath(routes, '/api/admin/user').post, [
      auditLog.record,
      users.usernameToUserId,
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
    assertHandlers(
      routeByPath(routes, '/api/admin/newsletter-subscribers/split').post,
      [
        auditLog.record,
        newsletter.uploadSubscribersCsv,
        newsletter.splitSubscribers,
      ],
    );
    assertHandlers(
      routeByPath(routes, '/api/admin/newsletter-subscribers').get,
      [auditLog.record, newsletter.list],
    );
    assertHandlers(
      routeByPath(routes, '/api/admin/newsletter-subscribers/audience').post,
      [auditLog.record, newsletter.audience],
    );
    assertHandlers(
      routeByPath(routes, '/api/admin/newsletter-subscribers/circle').get,
      [auditLog.record, newsletter.listCircleMembers],
    );
    routes.forEach(route => assertPolicy(route, policy));
  });

  it('registers simple integration routes for pages, statistics, and SparkPost', () => {
    const volunteers = controller(['list'], 'volunteers');
    const greeters = controller(['list'], 'greeters');
    const statistics = controller(
      ['collectStatistics', 'getPublicStatistics'],
      'statistics',
    );
    const sparkpost = controller(
      ['basicAuthenticate', 'receiveBatch'],
      'sparkpost',
    );

    const pagesRoutes = register(
      './../../../pages/server/routes/pages.server.routes.mjs',
      {
        '../controllers/pages.volunteers.server.controller': volunteers,
        '../controllers/pages.greeters.server.controller': greeters,
      },
    );
    const statisticsRoutes = register(
      './../../../statistics/server/routes/statistics.server.routes.mjs',
      {
        '../controllers/statistics.server.controller': statistics,
      },
    );
    const sparkpostRoutes = register(
      './../../../sparkpost/server/routes/sparkpost.server.routes.mts',
      {
        '../controllers/sparkpost-webhooks.server.controller': sparkpost,
      },
    );

    assertHandlers(routeByPath(pagesRoutes.routes, '/api/volunteers').get, [
      volunteers.list,
    ]);
    assertHandlers(routeByPath(pagesRoutes.routes, '/api/greeters').get, [
      greeters.list,
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
