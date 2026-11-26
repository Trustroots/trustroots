import { findDiscoveryOfferLocations } from '../../../offers/server/services/discovery-offers.server.service.mts';
import {
  removePendingContacts,
  userAccountServices,
} from '../../../../layers/server/user-account.mts';
import assert from 'assert';
import { nostrIdentity } from '../../../../layers/server/nostr-identity.mts';
import sinon from 'sinon';
import proxyquire from './../../../../testutils/server/mock-module.mts';
import { challenge } from './../../../users/server/controllers/users.nostr.server.controller.mts';
import userProfile from './../../../users/server/controllers/users.profile.server.controller.mts';
import unifiedPush from './../../../users/server/controllers/users.unified-push.server.controller.mts';
import {
  showUnsubscribe,
  unsubscribe,
} from './../../../users/server/controllers/users.notification-email.server.controller.mts';

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
  use(path: string, middleware: NamedHandler): void;
}
interface Recorder {
  app: RecorderApp;
  middlewarePaths: string[];
  params: Array<{ name: string; middleware: NamedHandler }>;
  routes: RecordedRoute[];
}
type RouteRegistrar = (app: RecorderApp, ...dependencies: unknown[]) => void;
type DependencyReplacements = Record<string, NamedHandler> | NamedHandler;

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
  const middlewarePaths: string[] = [];

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
      use(path) {
        middlewarePaths.push(path);
      },
    },
    middlewarePaths,
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

const elevationRoutes = new Set([
  '/api/admin/support/:requestId/repeated-messages',
  '/api/admin/support-message-reviews/:reviewId/repeated-messages',
  '/api/admin/hackerspaces/preview',
  '/api/admin/acquisition-stories',
  '/api/admin/audit-log',
  '/api/admin/audit-log/actors',
  '/api/admin/dashboard',
  '/api/admin/messages',
  '/api/admin/messages/scammer-recipients',
  '/api/admin/messages/scammer-warning',
  '/api/admin/threads',
  '/api/admin/notes',
  '/api/admin/users',
  '/api/admin/users/by-role',
  '/api/admin/users/by-last-ip-hash',
  '/api/admin/user',
  '/api/admin/staff-blockers',
  '/api/admin/user/change-role',
  '/api/admin/reference-threads',
  '/api/admin/newsletter-subscribers/split',
  '/api/admin/newsletter-subscribers',
  '/api/admin/newsletter-subscribers/audience',
  '/api/admin/newsletter-subscribers/circle',
]);

function assertPolicy(
  route: RecordedRoute,
  policy: { isAllowed: NamedHandler },
  requireAdminElevation?: NamedHandler,
) {
  const expected = [policy.isAllowed];
  if (requireAdminElevation && elevationRoutes.has(route.path)) {
    expected.push(requireAdminElevation);
  }
  const handlerNames = (handlers: NamedHandler[]) =>
    handlers.map(handler =>
      (handler.routeTestName || handler.name).split('.').pop(),
    );
  assert.deepStrictEqual(
    handlerNames(route.all),
    handlerNames(expected),
    `${route.path} policy`,
  );
}

async function register(
  modulePath: string,
  stubs: Record<string, DependencyReplacements>,
  ...dependencies: unknown[]
) {
  const { app, middlewarePaths, params, routes } = createAppRecorder();
  const { default: registerRoutes } = await proxyquire<{
    default: RouteRegistrar;
  }>(new URL(modulePath, import.meta.url), stubs);
  registerRoutes(app, ...dependencies);
  return { middlewarePaths, params, routes };
}

describe('API route registrations', () => {
  it('registers contacts routes with policy middleware and params', async () => {
    const policy = { isAllowed: handler('contactsPolicy.isAllowed') };
    const limits = { contactRequest: handler('requestLimit.contactRequest') };
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

    const { params, routes } = await register(
      './../../../contacts/server/routes/contacts.server.routes.mts',
      {
        '../controllers/contacts.server.controller': contacts,
        '../policies/contacts.server.policy': policy,
        '../../../core/server/middleware/targeted-request-limit.server.middleware':
          limits,
      },
    );

    assertHandlers(routeByPath(routes, '/api/contact').post, [
      limits.contactRequest,
      contacts.add,
    ]);
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

  it('registers messages routes with inbox, thread, counters, and sync handlers', async () => {
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

    const { params, routes } = await register(
      './../../../messages/server/routes/messages.server.routes.mts',
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
      params.map(param => param.name),
      ['messageUserId'],
    );
    const req = {};
    const res = {};
    const next = sinon.spy();
    const threadByUser = sinon.stub(messages, 'threadByUser');
    try {
      Reflect.apply(params[0].middleware, undefined, [
        req,
        res,
        next,
        'member-id',
        'messageUserId',
      ]);
      assert.deepStrictEqual(threadByUser.args, [
        [req, res, next, 'member-id'],
      ]);
    } finally {
      threadByUser.restore();
    }
  });

  it('registers offers routes with list, create, read, update, delete, and params', async () => {
    const policy = { isAllowed: handler('offersPolicy.isAllowed') };
    const searchLimit = handler('offerSearchLimit');
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

    const findConnections = async () => [];
    const createListHandler = sinon.stub().returns(offers.list);
    const { params, routes } = await register(
      './../../../offers/server/routes/offers.server.routes.mts',
      {
        '../controllers/offers.server.controller': {
          ...offers,
          createListHandler,
        },
        '../policies/offers.server.policy': policy,
        '../middleware/offer-search-limit.server.middleware': {
          getOfferSearchLimit: (() => searchLimit) as NamedHandler,
        },
      },
      findConnections,
    );

    sinon.assert.calledOnceWithExactly(createListHandler, findConnections);
    assertHandlers(routeByPath(routes, '/api/offers-by/:offerUserId').get, [
      offers.listOffersByUser,
    ]);
    assertHandlers(routeByPath(routes, '/api/offers').get, [
      searchLimit,
      offers.list,
    ]);
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

  it('registers reference thread routes and user lookup param', async () => {
    const policy = { isAllowed: handler('referenceThreadPolicy.isAllowed') };
    const referenceThread = controller(
      [
        'createReferenceThread',
        'readReferenceThread',
        'readReferenceThreadById',
      ],
      'referenceThread',
    );

    const { params, routes } = await register(
      './../../../references-thread/server/routes/reference-thread.server.routes.mts',
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

  it('registers tribes and support routes', async () => {
    const tribesPolicy = { isAllowed: handler('tribesPolicy.isAllowed') };
    const tribes = controller(
      [
        'getTribe',
        'listTribes',
        'listMembers',
        'listConnections',
        'tribeBySlug',
      ],
      'tribes',
    );
    const support = controller(['supportRequest'], 'support');
    const supportLimit = { support: handler('requestLimit.support') };

    const tribeRoutes = await register(
      './../../../tribes/server/routes/tribes.server.routes.mts',
      {
        '../controllers/tribes.server.controller': tribes,
        '../policies/tribes.server.policy': tribesPolicy,
      },
      findDiscoveryOfferLocations,
    );
    const { trustrootsNostrServiceName, trustrootsNostrServiceIdentifier } =
      await import('../../server/services/nostr-service-signer.server.mts');
    assert.equal(trustrootsNostrServiceName, '_');
    assert.equal(trustrootsNostrServiceIdentifier, '_@trustroots.org');
    const supportRoutes = await register(
      './../../../support/server/routes/support.server.routes.mts',
      {
        '../controllers/support.server.controller': support,
        '../../../core/server/middleware/targeted-request-limit.server.middleware':
          supportLimit,
      },
    );

    assert.deepStrictEqual(tribeRoutes.middlewarePaths, ['/api/tribes']);
    assertHandlers(routeByPath(tribeRoutes.routes, '/api/tribes').get, [
      tribes.listTribes,
    ]);
    assertHandlers(routeByPath(tribeRoutes.routes, '/api/tribes/:tribe').get, [
      tribes.getTribe,
    ]);
    tribeRoutes.routes
      .filter(route => route.path !== '/api/tribes/chat/:room')
      .forEach(route => assertPolicy(route, tribesPolicy));
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

  it('registers local authentication routes without social OAuth', async () => {
    const signinChallenge = handler('signinChallenge');
    const authentication = controller(
      [
        'cancelEmailChange',
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

    const { routes } = await register(
      './../../../users/server/routes/auth.server.routes.mts',
      {
        '../services/signin-challenge.server.service': signinChallenge,
        '../controllers/users.authentication.server.controller': authentication,
        '../controllers/users.password.server.controller': password,
        '../../../core/server/middleware/targeted-request-limit.server.middleware':
          targetedRequestLimit,
      },
    );

    for (const path of [
      '/api/auth/cancel-email-change',
      '/api/auth/confirm-email/:token/cancel',
    ]) {
      assertHandlers(routeByPath(routes, path).post, [
        authentication.cancelEmailChange,
      ]);
    }
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
      signinChallenge,
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

  it('registers users routes behind the users policy', async () => {
    const policy = { isAllowed: handler('usersPolicy.isAllowed') };
    const avatar = controller(
      [
        'avatarUploadField',
        'avatarUpload',
        'getAvatar',
        'userForAvatarByUserId',
      ],
      'avatar',
    );

    const { params, routes } = await register(
      './../../../users/server/routes/users.server.routes.mts',
      {
        '../controllers/users.avatar.server.controller': avatar,
        '../policies/users.server.policy': policy,
      },
      userAccountServices,
    );
    assert.strictEqual(routes.length, 19);

    const unsubscribeRoute = routeByPath(routes, '/email/unsubscribe/:token');
    assert.deepStrictEqual(unsubscribeRoute.all, []);
    assert.deepStrictEqual(unsubscribeRoute.get, [showUnsubscribe]);
    assert.deepStrictEqual(unsubscribeRoute.post, [unsubscribe]);
    routes
      .filter(route => route !== unsubscribeRoute)
      .forEach(route => assertPolicy(route, policy));
    assert.deepStrictEqual(
      routeByPath(routes, '/api/users/nostr/challenge').post,
      [challenge],
    );
    assert.deepStrictEqual(
      routeByPath(routes, '/api/users/me/safety-visit').put,
      [userProfile.recordSafetyPageVisit],
    );
    assert.deepStrictEqual(
      routeByPath(routes, '/api/users/unified-push/test').post,
      [unifiedPush.test],
    );
    assert.deepStrictEqual(
      routeByPath(routes, '/api/users-avatar').post.slice(1),
      [avatar.avatarUploadField, avatar.avatarUpload],
    );
    assert.deepStrictEqual(
      routeByPath(routes, '/api/users/:avatarUserId/avatar').get,
      [avatar.getAvatar],
    );
    assert.deepStrictEqual(
      params.map(param => param.name),
      ['userId', 'username', 'avatarUserId'],
    );
    assert.strictEqual(params[2]?.middleware, avatar.userForAvatarByUserId);
  });

  it('registers blocked-user routes', async () => {
    const policy = { isAllowed: handler('usersPolicy.isAllowed') };
    const blockUser = sinon.spy();
    const block = controller(
      ['blockUser', 'getBlockedUsers', 'unblockUser'],
      'userBlock',
    );

    const { routes } = await register(
      './../../../users/server/routes/users-block.server.routes.mts',
      {
        '../controllers/users.block.server.controller': { ...block, blockUser },
        '../policies/users.server.policy': policy,
      },
      removePendingContacts,
    );

    assertHandlers(routeByPath(routes, '/api/blocked-users').get, [
      block.getBlockedUsers,
    ]);
    const puts = routeByPath(routes, '/api/blocked-users/:username').put;
    assert.equal(puts.length, 1);
    const req = {};
    const res = {};
    puts[0]!(req, res);
    sinon.assert.calledOnceWithExactly(
      blockUser,
      removePendingContacts,
      req,
      res,
    );
    assertHandlers(routeByPath(routes, '/api/blocked-users/:username').delete, [
      block.unblockUser,
    ]);
    routes.forEach(route => assertPolicy(route, policy));
  });

  it('registers member session management routes with password confirmation and a dedicated limit', async () => {
    const [
      { default: memberSessionRoutes },
      memberSessionController,
      { default: targetedRequestLimit },
    ] = await Promise.all([
      import('../../../users/server/routes/sessions.server.routes.mts'),
      import('../../../users/server/controllers/users.sessions.server.controller.mts'),
      import('../../server/middleware/targeted-request-limit.server.middleware.mts'),
    ]);
    const { app, routes } = createAppRecorder();
    memberSessionRoutes(app);

    assert.deepStrictEqual(
      routeByPath(routes, '/api/auth/sessions').all.concat(
        routeByPath(routes, '/api/auth/sessions').get,
      ),
      [memberSessionController.requireMember, memberSessionController.list],
    );
    assert.deepStrictEqual(
      routeByPath(routes, '/api/auth/sessions').all.concat(
        routeByPath(routes, '/api/auth/sessions').delete,
      ),
      [
        memberSessionController.requireMember,
        targetedRequestLimit.manageSessions,
        memberSessionController.confirmPassword,
        memberSessionController.revokeAll,
      ],
    );
    assert.deepStrictEqual(
      routeByPath(routes, '/api/auth/sessions/:id').all.concat(
        routeByPath(routes, '/api/auth/sessions/:id').delete,
      ),
      [
        memberSessionController.requireMember,
        targetedRequestLimit.manageSessions,
        memberSessionController.confirmPassword,
        memberSessionController.revoke,
      ],
    );
  });

  it('registers admin routes with audit log middleware where required', async () => {
    const policy = { isAllowed: handler('adminPolicy.isAllowed') };
    const elevation = controller(
      ['requireAdminElevation', 'confirmAdminPassword', 'elevateAdminSession'],
      'adminElevation',
    );
    const support = controller(
      [
        'list',
        'detail',
        'setStatus',
        'investigation',
        'reportRepeatedMessages',
        'throttleRepeatedMessages',
        'searchMembers',
        'flaggedMembers',
        'setFlag',
        'member',
      ],
      'support',
    );
    const acquisitionStories = controller(
      ['list', 'resendConfirmation'],
      'adminAcquisitionStories',
    );
    const auditLog = controller(['list', 'record', 'actors'], 'adminAuditLog');
    const usernameChanges = controller(['list'], 'adminUsernameChanges');
    const unsuspension = controller(['unsuspendMember'], 'adminUnsuspension');
    const gravatar = controller(['list'], 'adminGravatar');
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
    const circles = controller(
      ['create', 'get', 'list', 'processImageUpload', 'update'],
      'adminCircles',
    );
    const threads = controller(['getThreads'], 'adminThreads');
    const users = controller(
      [
        'changeRole',
        'getUser',
        'listUsersByLastIpHash',
        'listUsersByRole',
        'searchUsers',
        'usernameToUserId',
      ],
      'adminUsers',
    );

    const { routes } = await register(
      './../../../admin/server/routes/admin.server.routes.mts',
      {
        '../controllers/admin.support.server.controller': support,
        '../controllers/admin.acquisition-stories.server.controller':
          acquisitionStories,
        '../controllers/admin.audit-log.server.controller': auditLog,
        '../controllers/admin.gravatar.server.controller': gravatar,
        '../controllers/admin.unsuspend.server.controller': unsuspension,
        '../controllers/admin.username-changes.server.controller':
          usernameChanges,
        '../controllers/admin.location-corrections.server.controller':
          locationCorrections,
        '../controllers/admin.messages.server.controller': messages,
        '../controllers/admin.newsletter.server.controller': newsletter,
        '../controllers/admin.notes.server.controller': notes,
        '../controllers/admin.reference-threads.server.controller':
          referenceThreads,
        '../controllers/admin.circles.server.controller': circles,
        '../controllers/admin.threads.server.controller': threads,
        '../controllers/admin.users.server.controller': users,
        '../policies/admin.server.policy': policy,
        '../services/admin-elevation.server.service': elevation,
      },
      userAccountServices,
      nostrIdentity.findPublicNip05Usernames,
    );

    assertHandlers(routeByPath(routes, '/api/admin/gravatar').get, [
      gravatar.list,
    ]);
    assertHandlers(routeByPath(routes, '/api/admin/user/unsuspend').post, [
      unsuspension.unsuspendMember,
    ]);
    assertHandlers(
      routeByPath(routes, '/api/admin/support-flagged-members').get,
      [support.flaggedMembers],
    );
    assertHandlers(
      routeByPath(routes, '/api/admin/support-members/:memberId/flag').patch,
      [support.setFlag],
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
    assertHandlers(
      routeByPath(routes, '/api/admin/support/:requestId/repeated-messages')
        .get,
      [support.reportRepeatedMessages],
    );
    assertHandlers(
      routeByPath(
        routes,
        '/api/admin/support-message-reviews/:reviewId/repeated-messages',
      ).get,
      [support.throttleRepeatedMessages],
    );
    assertHandlers(routeByPath(routes, '/api/admin/location-corrections').get, [
      auditLog.record,
      locationCorrections.list,
    ]);
    assertHandlers(
      routeByPath(routes, '/api/admin/location-corrections/send').post,
      [auditLog.record, locationCorrections.send],
    );
    assertHandlers(routeByPath(routes, '/api/admin/elevate').post, [
      elevation.confirmAdminPassword,
      elevation.elevateAdminSession,
    ]);

    assertHandlers(routeByPath(routes, '/api/admin/acquisition-stories').post, [
      auditLog.record,
      acquisitionStories.list,
    ]);
    assertHandlers(
      routeByPath(
        routes,
        '/api/admin/acquisition-stories/:memberId/resend-confirmation',
      ).post,
      [auditLog.record, acquisitionStories.resendConfirmation],
    );
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
    assertHandlers(routeByPath(routes, '/api/admin/username-changes').get, [
      auditLog.record,
      usernameChanges.list,
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
      routeByPath(routes, '/api/admin/users/by-last-ip-hash').post,
      [auditLog.record, users.listUsersByLastIpHash],
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
    assertHandlers(routeByPath(routes, '/api/admin/circles').get, [
      auditLog.record,
      circles.list,
    ]);
    assertHandlers(routeByPath(routes, '/api/admin/circles').post, [
      circles.processImageUpload,
      auditLog.record,
      circles.create,
    ]);
    assertHandlers(routeByPath(routes, '/api/admin/circles/:circle').get, [
      auditLog.record,
      circles.get,
    ]);
    assertHandlers(routeByPath(routes, '/api/admin/circles/:circle').put, [
      circles.processImageUpload,
      auditLog.record,
      circles.update,
    ]);
    routes.forEach(route =>
      assertPolicy(route, policy, elevation.requireAdminElevation),
    );
  });

  it('registers simple integration routes for pages, statistics, and SparkPost', async () => {
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

    const pagesRoutes = await register(
      './../../../pages/server/routes/pages.server.routes.mts',
      {
        '../controllers/pages.volunteers.server.controller': volunteers,
        '../controllers/pages.greeters.server.controller': greeters,
      },
    );
    const statisticsRoutes = await register(
      './../../../statistics/server/routes/statistics.server.routes.mts',
      {
        '../controllers/statistics.server.controller': statistics,
      },
    );
    const sparkpostRoutes = await register(
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
