const STATUS = {
  active: 'active',
  excluded: 'excluded',
};

const AREA = {
  publicCore: 'public-core',
  authAccount: 'auth-account',
  profileOnboarding: 'profile-onboarding',
  searchOffersCircles: 'search-offers-circles',
  relationshipsSafety: 'relationships-safety',
  messages: 'messages',
  experiencesReferences: 'experiences-references',
  adminModeration: 'admin-moderation',
  integrationsExcluded: 'integrations-excluded',
};

const ROLE_DEFINITIONS = {
  visitor: 'Unauthenticated browser user.',
  member:
    'Authenticated user; use a narrower role when the feature depends on public/confirmed profile state.',
  'unconfirmed-member':
    'Authenticated user whose profile is not yet public because email confirmation is pending.',
  'confirmed-member':
    'Authenticated public user; required for APIs that enforce req.user.public === true.',
  'shadowbanned-member':
    'Authenticated user with the shadowban role, used to verify hidden member-facing behavior.',
  admin: 'Authenticated user with the admin role.',
  browser:
    'Browser/platform-originated request, such as security reporting telemetry.',
  'external-client':
    'Non-browser client or integration endpoint excluded from web feature coverage.',
  'external-service':
    'Third-party service callback or webhook excluded from web feature coverage.',
};

const source = {
  adminClient: 'modules/admin/client/config/admin.client.routes.js',
  adminServer: 'modules/admin/server/routes/admin.server.routes.js',
  contactsClient: 'modules/contacts/client/config/contacts.client.routes.js',
  contactsServer: 'modules/contacts/server/routes/contacts.server.routes.js',
  coreClient: 'modules/core/client/config/core.client.routes.js',
  coreServer: 'modules/core/server/routes/core.server.routes.js',
  experiencesServer:
    'modules/experiences/server/routes/experiences.server.routes.js',
  messagesClient: 'modules/messages/client/config/messages.client.routes.js',
  messagesServer: 'modules/messages/server/routes/messages.server.routes.js',
  offersClient: 'modules/offers/client/config/offers.client.routes.js',
  offersServer: 'modules/offers/server/routes/offers.server.routes.js',
  pagesClient: 'modules/pages/client/config/pages.client.routes.js',
  pagesServer: 'modules/pages/server/routes/admin.server.routes.js',
  referencesThreadServer:
    'modules/references-thread/server/routes/reference-thread.server.routes.js',
  searchClient: 'modules/search/client/config/search.client.routes.js',
  sparkpostServer: 'modules/sparkpost/server/routes/sparkpost.server.routes.js',
  statisticsClient:
    'modules/statistics/client/config/statistics.client.routes.js',
  statisticsServer:
    'modules/statistics/server/routes/statistics.server.routes.js',
  supportClient: 'modules/support/client/config/support.client.routes.js',
  supportServer: 'modules/support/server/routes/support.server.routes.js',
  tribesClient: 'modules/tribes/client/config/tribes.client.routes.js',
  tribesServer: 'modules/tribes/server/routes/tribes.server.routes.js',
  usersClient: 'modules/users/client/config/users.client.routes.js',
  usersServer: 'modules/users/server/routes/users.server.routes.js',
  usersAuthServer: 'modules/users/server/routes/auth.server.routes.js',
  usersBlockServer: 'modules/users/server/routes/users-block.server.routes.js',
};

function clientRoute(state, url, routeSource, extra = {}) {
  return {
    state,
    url,
    source: routeSource,
    ...extra,
  };
}

function apiRoute(method, path, routeSource, extra = {}) {
  return {
    method,
    path,
    source: routeSource,
    ...extra,
  };
}

const specPaths = {
  'account-email-tokens.spec.js':
    'features/auth-account/account-email-tokens.spec.js',
  'account-settings.spec.js': 'features/auth-account/account-settings.spec.js',
  'admin-acquisition.spec.js':
    'features/admin-moderation/admin-acquisition.spec.js',
  'admin-inspection.spec.js':
    'features/admin-moderation/admin-inspection.spec.js',
  'admin-newsletter-api.spec.js':
    'features/admin-moderation/admin-newsletter-api.spec.js',
  'admin-notes.spec.js': 'features/admin-moderation/admin-notes.spec.js',
  'admin-pages.spec.js': 'features/admin-moderation/admin-pages.spec.js',
  'admin-reference-errors.spec.js':
    'features/admin-moderation/admin-reference-errors.spec.js',
  'admin-role-audit.spec.js':
    'features/admin-moderation/admin-role-audit.spec.js',
  'admin-search.spec.js': 'features/admin-moderation/admin-search.spec.js',
  'auth-smoke.spec.js': 'features/auth-account/auth-smoke.spec.js',
  'authenticated.spec.js': 'features/profile-onboarding/authenticated.spec.js',
  'contacts-and-blocks.spec.js':
    'features/relationships-safety/contacts-and-blocks.spec.js',
  'core-gaps.spec.js': 'features/public-core/core-gaps.spec.js',
  'experience-actions.spec.js':
    'features/experiences-references/experience-actions.spec.js',
  'experiences.spec.js': 'features/experiences-references/experiences.spec.js',
  'member.spec.js': 'features/profile-onboarding/member.spec.js',
  'message-actions.spec.js': 'features/messages/message-actions.spec.js',
  'messages-api.spec.js': 'features/messages/messages-api.spec.js',
  'messages.spec.js': 'features/messages/messages.spec.js',
  'nostr.spec.js': 'features/public-core/nostr.spec.js',
  'offers-and-circles.spec.js':
    'features/search-offers-circles/offers-and-circles.spec.js',
  'public-pages.spec.js': 'features/public-core/public-pages.spec.js',
  'search-map-rendered.spec.js':
    'features/search-offers-circles/search-map-rendered.spec.js',
  'seeded-content.spec.js': 'features/public-core/seeded-content.spec.js',
};

function spec(file, title) {
  return {
    file: `tests/e2e/${specPaths[file] || file}`,
    title,
  };
}

const features = [
  {
    id: 'public.home',
    area: AREA.publicCore,
    status: STATUS.active,
    description:
      'Visitors can load the homepage and reach authentication entry points.',
    roles: ['visitor'],
    references: {
      clientRoutes: [clientRoute('home', '/?tribe?circle', source.pagesClient)],
      apiRoutes: [],
    },
    requiredScenarios: [
      'Homepage loads for visitors.',
      'Sign in and sign up entry points are visible.',
      'Optional circle/tribe query parameters do not break the page.',
    ],
    relatedSpecs: [
      spec(
        'auth-smoke.spec.js',
        'homepage loads and exposes authentication entry points',
      ),
    ],
  },
  {
    id: 'public.not-found',
    area: AREA.publicCore,
    status: STATUS.active,
    description:
      'Unknown browser routes render the user-facing not found page.',
    roles: ['visitor', 'member'],
    references: {
      clientRoutes: [clientRoute('not-found', '/not-found', source.coreClient)],
      apiRoutes: [
        apiRoute(
          'GET',
          '/:url(api|modules|lib|developers)/*',
          source.coreServer,
        ),
      ],
    },
    requiredScenarios: [
      'Unknown client route redirects to /not-found.',
      'Unknown API/module/lib/developer route returns not found.',
    ],
    relatedSpecs: [
      spec('public-pages.spec.js', 'unknown routes render the not found page'),
    ],
  },
  {
    id: 'public.rules',
    area: AREA.publicCore,
    status: STATUS.active,
    description: 'Rules page is available to visitors.',
    roles: ['visitor'],
    references: {
      clientRoutes: [clientRoute('rules', '/rules', source.pagesClient)],
      apiRoutes: [],
    },
    requiredScenarios: ['Rules page loads with the expected title/content.'],
    relatedSpecs: [
      spec('public-pages.spec.js', 'public marketing page /rules loads'),
    ],
  },
  {
    id: 'public.team',
    area: AREA.publicCore,
    status: STATUS.active,
    description: 'Team page and volunteers list are available to visitors.',
    roles: ['visitor'],
    references: {
      clientRoutes: [clientRoute('team', '/team', source.pagesClient)],
      apiRoutes: [apiRoute('GET', '/api/volunteers', source.pagesServer)],
    },
    requiredScenarios: [
      'Team page loads.',
      'Volunteers API returns the data used by the public team page.',
    ],
    relatedSpecs: [
      spec('public-pages.spec.js', 'public marketing page /team loads'),
    ],
  },
  {
    id: 'public.privacy',
    area: AREA.publicCore,
    status: STATUS.active,
    description: 'Privacy policy page is available to visitors.',
    roles: ['visitor'],
    references: {
      clientRoutes: [clientRoute('privacy', '/privacy', source.pagesClient)],
      apiRoutes: [],
    },
    requiredScenarios: ['Privacy page loads with the expected title/content.'],
    relatedSpecs: [
      spec('public-pages.spec.js', 'public marketing page /privacy loads'),
    ],
  },
  {
    id: 'public.contribute',
    area: AREA.publicCore,
    status: STATUS.active,
    description: 'Contribute page is available to visitors.',
    roles: ['visitor'],
    references: {
      clientRoutes: [
        clientRoute('contribute', '/contribute', source.pagesClient),
      ],
      apiRoutes: [],
    },
    requiredScenarios: [
      'Contribute page loads with the expected title/content.',
    ],
    relatedSpecs: [
      spec('public-pages.spec.js', 'public marketing page /contribute loads'),
    ],
  },
  {
    id: 'public.faq-general',
    area: AREA.publicCore,
    status: STATUS.active,
    description: 'General FAQ page is available to visitors.',
    roles: ['visitor'],
    references: {
      clientRoutes: [
        clientRoute('faq.general', '/faq', source.pagesClient, {
          parentState: 'faq',
        }),
      ],
      apiRoutes: [],
    },
    requiredScenarios: ['General FAQ page loads.'],
    relatedSpecs: [
      spec('public-pages.spec.js', 'public marketing page /faq loads'),
    ],
  },
  {
    id: 'public.faq-circles',
    area: AREA.publicCore,
    status: STATUS.active,
    description: 'Circles FAQ page is available to visitors.',
    roles: ['visitor'],
    references: {
      clientRoutes: [
        clientRoute('faq.circles', '/faq/circles', source.pagesClient, {
          parentState: 'faq',
        }),
      ],
      apiRoutes: [],
    },
    requiredScenarios: ['Circles FAQ page loads.'],
    relatedSpecs: [
      spec('public-pages.spec.js', 'public marketing page /faq/circles loads'),
    ],
  },
  {
    id: 'public.faq-foundation',
    area: AREA.publicCore,
    status: STATUS.active,
    description: 'Foundation FAQ page is available to visitors.',
    roles: ['visitor'],
    references: {
      clientRoutes: [
        clientRoute('faq.foundation', '/faq/foundation', source.pagesClient, {
          parentState: 'faq',
        }),
      ],
      apiRoutes: [],
    },
    requiredScenarios: ['Foundation FAQ page loads.'],
    relatedSpecs: [
      spec(
        'public-pages.spec.js',
        'public marketing page /faq/foundation loads',
      ),
    ],
  },
  {
    id: 'public.faq-technology',
    area: AREA.publicCore,
    status: STATUS.active,
    description: 'Technology FAQ page is available to visitors.',
    roles: ['visitor'],
    references: {
      clientRoutes: [
        clientRoute('faq.technology', '/faq/technology', source.pagesClient, {
          parentState: 'faq',
        }),
      ],
      apiRoutes: [],
    },
    requiredScenarios: ['Technology FAQ page loads.'],
    relatedSpecs: [
      spec(
        'public-pages.spec.js',
        'public marketing page /faq/technology loads',
      ),
    ],
  },
  {
    id: 'public.faq-bugs-and-features',
    area: AREA.publicCore,
    status: STATUS.active,
    description: 'Bugs and features FAQ page is available to visitors.',
    roles: ['visitor'],
    references: {
      clientRoutes: [
        clientRoute(
          'faq.bugs-and-features',
          '/faq/bugs-and-features',
          source.pagesClient,
          { parentState: 'faq' },
        ),
      ],
      apiRoutes: [],
    },
    requiredScenarios: ['Bugs and features FAQ page loads.'],
    relatedSpecs: [
      spec(
        'public-pages.spec.js',
        'public marketing page /faq/bugs-and-features loads',
      ),
    ],
  },
  {
    id: 'public.foundation',
    area: AREA.publicCore,
    status: STATUS.active,
    description: 'Foundation page is available to visitors.',
    roles: ['visitor'],
    references: {
      clientRoutes: [
        clientRoute('foundation', '/foundation', source.pagesClient),
      ],
      apiRoutes: [],
    },
    requiredScenarios: ['Foundation page loads.'],
    relatedSpecs: [
      spec('public-pages.spec.js', 'public marketing page /foundation loads'),
    ],
  },
  {
    id: 'public.media',
    area: AREA.publicCore,
    status: STATUS.active,
    description: 'Media page is available to visitors.',
    roles: ['visitor'],
    references: {
      clientRoutes: [clientRoute('media', '/media', source.pagesClient)],
      apiRoutes: [],
    },
    requiredScenarios: ['Media page loads.'],
    relatedSpecs: [
      spec('public-pages.spec.js', 'public marketing page /media loads'),
    ],
  },
  {
    id: 'public.volunteering',
    area: AREA.publicCore,
    status: STATUS.active,
    description: 'Volunteering page is available to visitors.',
    roles: ['visitor'],
    references: {
      clientRoutes: [
        clientRoute('volunteering', '/volunteering', source.pagesClient),
      ],
      apiRoutes: [],
    },
    requiredScenarios: ['Volunteering page loads.'],
    relatedSpecs: [
      spec('public-pages.spec.js', 'public marketing page /volunteering loads'),
    ],
  },
  {
    id: 'public.guide',
    area: AREA.publicCore,
    status: STATUS.active,
    description: 'Guide page is available to visitors.',
    roles: ['visitor'],
    references: {
      clientRoutes: [clientRoute('guide', '/guide', source.pagesClient)],
      apiRoutes: [],
    },
    requiredScenarios: ['Guide page loads.'],
    relatedSpecs: [
      spec('public-pages.spec.js', 'public marketing page /guide loads'),
    ],
  },
  {
    id: 'public.about-redirect',
    area: AREA.publicCore,
    status: STATUS.active,
    description: 'Legacy about route redirects to the homepage.',
    roles: ['visitor'],
    references: {
      clientRoutes: [clientRoute('about', '/about', source.pagesClient)],
      apiRoutes: [],
    },
    requiredScenarios: ['/about redirects to the homepage.'],
    relatedSpecs: [
      spec('public-pages.spec.js', '/about redirects to the homepage'),
    ],
  },
  {
    id: 'public.navigation',
    area: AREA.publicCore,
    status: STATUS.active,
    description:
      'Authenticated members can open the compact navigation page and sign out from it.',
    roles: ['member'],
    references: {
      clientRoutes: [
        clientRoute('navigation', '/navigation', source.pagesClient, {
          requiresAuth: true,
        }),
      ],
      apiRoutes: [apiRoute('GET', '/api/auth/signout', source.usersAuthServer)],
    },
    requiredScenarios: [
      'Member navigation page loads.',
      'Navigation lists the expected member shortcuts.',
      'Sign out action clears the session.',
    ],
    relatedSpecs: [
      spec('authenticated.spec.js', 'navigation page lists member shortcuts'),
      spec('authenticated.spec.js', 'member can sign out'),
    ],
  },
  {
    id: 'public.support-page',
    area: AREA.publicCore,
    status: STATUS.active,
    description: 'Support page is available and renders the contact form.',
    roles: ['visitor', 'member'],
    references: {
      clientRoutes: [
        clientRoute('support', '/support?report=', source.supportClient),
      ],
      apiRoutes: [],
    },
    requiredScenarios: [
      'Support page loads for visitors.',
      'Support page accepts the report query parameter.',
      'Support contact form is visible.',
    ],
    relatedSpecs: [
      spec('public-pages.spec.js', 'public marketing page /support loads'),
      spec('public-pages.spec.js', 'support page renders the contact form'),
    ],
  },
  {
    id: 'public.support-submit',
    area: AREA.publicCore,
    status: STATUS.active,
    description: 'Visitors and members can submit support requests.',
    roles: ['visitor', 'member'],
    references: {
      clientRoutes: [
        clientRoute('support', '/support?report=', source.supportClient),
      ],
      apiRoutes: [apiRoute('POST', '/api/support', source.supportServer)],
    },
    requiredScenarios: [
      'Support request submission succeeds with valid data.',
      'Support request validation errors are shown without sending email.',
    ],
    relatedSpecs: [],
  },
  {
    id: 'public.statistics',
    area: AREA.publicCore,
    status: STATUS.active,
    description: 'Statistics page and public statistics API are available.',
    roles: ['visitor', 'member'],
    references: {
      clientRoutes: [
        clientRoute('statistics', '/statistics', source.statisticsClient),
      ],
      apiRoutes: [apiRoute('GET', '/api/statistics', source.statisticsServer)],
    },
    requiredScenarios: [
      'Statistics page loads for visitors.',
      'Statistics page loads for signed-in members.',
      'Public statistics API returns deterministic data.',
    ],
    relatedSpecs: [
      spec('seeded-content.spec.js', 'statistics page loads for visitors'),
      spec(
        'authenticated.spec.js',
        'statistics page loads for a signed in member',
      ),
    ],
  },
  {
    id: 'public.languages-api',
    area: AREA.publicCore,
    status: STATUS.active,
    description:
      'Language API returns available locales for client language UX.',
    roles: ['visitor', 'member'],
    references: {
      clientRoutes: [],
      apiRoutes: [apiRoute('GET', '/api/languages', source.coreServer)],
    },
    requiredScenarios: ['Languages API returns a non-empty locale list.'],
    relatedSpecs: [
      spec('seeded-content.spec.js', 'languages API returns a non-empty list'),
    ],
  },
  {
    id: 'public.nostr-well-known',
    area: AREA.publicCore,
    status: STATUS.active,
    description:
      'NIP-05 well-known endpoint exposes valid public Nostr keys only.',
    roles: ['visitor'],
    references: {
      clientRoutes: [],
      apiRoutes: [
        apiRoute('GET', '/.well-known/nostr.json', source.coreServer),
      ],
    },
    requiredScenarios: [
      'Invalid name query returns 400.',
      'Unknown user returns an empty names object with CORS headers.',
      'Unconfirmed or hidden users are not exposed.',
      'Public member with a valid npub is exposed as NIP-05 hex key.',
    ],
    relatedSpecs: [
      spec('nostr.spec.js', 'rejects a non-string username with a 400'),
      spec('nostr.spec.js', 'rejects an empty username with a 400'),
      spec(
        'nostr.spec.js',
        'returns empty names with an open CORS header for unknown users',
      ),
      spec(
        'nostr.spec.js',
        'does not expose npubs for non-public (unconfirmed) members',
      ),
    ],
  },
  {
    id: 'public.service-worker-config',
    area: AREA.publicCore,
    status: STATUS.active,
    description:
      'Service worker config endpoint renders app config for push UX.',
    roles: ['visitor', 'member'],
    references: {
      clientRoutes: [],
      apiRoutes: [apiRoute('GET', '/config/sw.js', source.coreServer)],
    },
    requiredScenarios: [
      'Endpoint returns JavaScript config without requiring authentication.',
    ],
    relatedSpecs: [],
  },
  {
    id: 'public.legacy-invite-redirect',
    area: AREA.publicCore,
    status: STATUS.active,
    description: 'Legacy invite route redirects visitors to signup.',
    roles: ['visitor'],
    references: {
      clientRoutes: [],
      apiRoutes: [apiRoute('GET', '/invite', source.coreServer)],
    },
    requiredScenarios: ['/invite redirects to /signup.'],
    relatedSpecs: [],
  },
  {
    id: 'public.legacy-tribes-redirects',
    area: AREA.publicCore,
    status: STATUS.active,
    description: 'Legacy tribe URLs redirect to circles equivalents.',
    roles: ['visitor', 'member'],
    references: {
      clientRoutes: [],
      apiRoutes: [
        apiRoute('GET', '/tribes', source.coreServer),
        apiRoute('GET', '/tribes/:tribe', source.coreServer),
        apiRoute('GET', '/tribes/lgbt', source.coreServer),
        apiRoute('GET', '/tribes/vegans-vegetarians', source.coreServer),
        apiRoute('GET', '/faq/tribes', source.coreServer),
      ],
    },
    requiredScenarios: [
      'Legacy /tribes route redirects to /circles.',
      'Legacy tribe detail route redirects to /circles/:circle.',
      'Known renamed legacy tribes redirect to their new circle slugs.',
      'Legacy /faq/tribes redirects to /faq/circles.',
    ],
    relatedSpecs: [],
  },
  {
    id: 'public.contact-legacy',
    area: AREA.publicCore,
    status: STATUS.excluded,
    description: 'Deprecated /contact alias for the support page.',
    roles: ['visitor', 'member'],
    references: {
      clientRoutes: [clientRoute('contact', '/contact', source.supportClient)],
      apiRoutes: [],
    },
    exclusionReason:
      'Deprecated since 2016; support page is the maintained feature surface.',
    replacedBy: 'public.support-page',
    requiredScenarios: [],
    relatedSpecs: [
      spec('public-pages.spec.js', 'public marketing page /contact loads'),
    ],
  },
  {
    id: 'auth.signup',
    area: AREA.authAccount,
    status: STATUS.active,
    description:
      'Visitors can create an account through the signup UI and signup API.',
    roles: ['visitor'],
    references: {
      clientRoutes: [
        clientRoute('signup', '/signup?tribe', source.usersClient),
      ],
      apiRoutes: [apiRoute('POST', '/api/auth/signup', source.usersAuthServer)],
    },
    requiredScenarios: [
      'Signup form validates required fields.',
      'Signup succeeds for a unique user.',
      'Signup can preload suggested circles from the tribe query parameter.',
    ],
    relatedSpecs: [
      spec('auth-smoke.spec.js', 'signup submits a unique user through the UI'),
    ],
  },
  {
    id: 'auth.signup-validation',
    area: AREA.authAccount,
    status: STATUS.active,
    description: 'Signup validation API reports username/email availability.',
    roles: ['visitor'],
    references: {
      clientRoutes: [
        clientRoute('signup', '/signup?tribe', source.usersClient),
      ],
      apiRoutes: [
        apiRoute('POST', '/api/auth/signup/validate', source.usersAuthServer),
      ],
    },
    requiredScenarios: [
      'Available username/email combination passes validation.',
      'Duplicate or invalid username/email shows a validation error.',
    ],
    relatedSpecs: [],
  },
  {
    id: 'auth.signin',
    area: AREA.authAccount,
    status: STATUS.active,
    description:
      'Existing members can sign in with username or email and reach the app.',
    roles: ['visitor'],
    references: {
      clientRoutes: [
        clientRoute('signin', '/signin?continue', source.usersClient),
      ],
      apiRoutes: [apiRoute('POST', '/api/auth/signin', source.usersAuthServer)],
    },
    requiredScenarios: [
      'Sign in page links to signup.',
      'Username sign in succeeds.',
      'Email sign in succeeds.',
      'Continue query redirects to the original protected destination.',
    ],
    relatedSpecs: [
      spec(
        'public-pages.spec.js',
        'sign in and sign up pages link to each other',
      ),
      spec('auth-smoke.spec.js', 'signed out user can sign in with username'),
      spec('auth-smoke.spec.js', 'signed out user can sign in with email'),
    ],
  },
  {
    id: 'auth.invalid-credentials',
    area: AREA.authAccount,
    status: STATUS.active,
    description:
      'Invalid credentials show an error without signing the user in.',
    roles: ['visitor'],
    references: {
      clientRoutes: [
        clientRoute('signin', '/signin?continue', source.usersClient),
      ],
      apiRoutes: [apiRoute('POST', '/api/auth/signin', source.usersAuthServer)],
    },
    requiredScenarios: [
      'Invalid username/password response is surfaced to the user.',
      'User remains on the sign in page.',
    ],
    relatedSpecs: [
      spec(
        'public-pages.spec.js',
        'signing in with invalid credentials shows an error and stays on the sign in page',
      ),
    ],
  },
  {
    id: 'auth.protected-route-redirect',
    area: AREA.authAccount,
    status: STATUS.active,
    description: 'Visitors are redirected to sign in before protected routes.',
    roles: ['visitor'],
    references: {
      clientRoutes: [
        clientRoute('inbox', '/messages', source.messagesClient, {
          requiresAuth: true,
        }),
        clientRoute('search.map', '/search', source.searchClient, {
          requiresAuth: true,
        }),
      ],
      apiRoutes: [],
    },
    requiredScenarios: [
      'Visiting a protected member route while signed out redirects to /signin.',
    ],
    relatedSpecs: [
      spec(
        'public-pages.spec.js',
        'visiting an authenticated route while signed out redirects to sign in',
      ),
    ],
  },
  {
    id: 'auth.signout',
    area: AREA.authAccount,
    status: STATUS.active,
    description: 'Members can sign out and clear their authenticated session.',
    roles: ['member'],
    references: {
      clientRoutes: [
        clientRoute('navigation', '/navigation', source.pagesClient, {
          requiresAuth: true,
        }),
      ],
      apiRoutes: [apiRoute('GET', '/api/auth/signout', source.usersAuthServer)],
    },
    requiredScenarios: [
      'Sign out endpoint clears the session.',
      'Browser lands on the homepage after sign out.',
    ],
    relatedSpecs: [spec('authenticated.spec.js', 'member can sign out')],
  },
  {
    id: 'auth.email-confirm',
    area: AREA.authAccount,
    status: STATUS.active,
    description: 'Members can confirm their email with a valid token.',
    roles: ['visitor', 'member'],
    references: {
      clientRoutes: [
        clientRoute(
          'confirm-email',
          '/confirm-email/:token?signup',
          source.usersClient,
        ),
      ],
      apiRoutes: [
        apiRoute(
          'GET',
          '/api/auth/confirm-email/:token',
          source.usersAuthServer,
        ),
        apiRoute(
          'POST',
          '/api/auth/confirm-email/:token',
          source.usersAuthServer,
        ),
      ],
    },
    requiredScenarios: [
      'Valid confirmation token can be validated.',
      'Confirming the token activates the member profile.',
      'Signup-specific confirmation messaging is shown when appropriate.',
    ],
    relatedSpecs: [],
  },
  {
    id: 'auth.email-confirm-invalid',
    area: AREA.authAccount,
    status: STATUS.active,
    description: 'Invalid or expired email confirmation links show guidance.',
    roles: ['visitor', 'member'],
    references: {
      clientRoutes: [
        clientRoute(
          'confirm-email-invalid',
          '/confirm-email-invalid',
          source.usersClient,
        ),
      ],
      apiRoutes: [
        apiRoute(
          'GET',
          '/api/auth/confirm-email/:token',
          source.usersAuthServer,
        ),
      ],
    },
    requiredScenarios: [
      'Invalid confirmation token routes to the invalid confirmation page.',
      'Invalid confirmation page offers a recovery path.',
    ],
    relatedSpecs: [],
  },
  {
    id: 'auth.email-resend',
    area: AREA.authAccount,
    status: STATUS.active,
    description: 'Unconfirmed members can request a new confirmation email.',
    roles: ['unconfirmed-member'],
    references: {
      clientRoutes: [],
      apiRoutes: [
        apiRoute(
          'POST',
          '/api/auth/resend-confirmation',
          source.usersAuthServer,
        ),
      ],
    },
    requiredScenarios: [
      'Resend confirmation succeeds for an unconfirmed member.',
      'Resend confirmation handles already-confirmed or invalid accounts.',
    ],
    relatedSpecs: [],
  },
  {
    id: 'auth.password-forgot',
    area: AREA.authAccount,
    status: STATUS.active,
    description: 'Visitors can request a password reset.',
    roles: ['visitor'],
    references: {
      clientRoutes: [
        clientRoute(
          'forgot',
          '/password/forgot?userhandle=',
          source.usersClient,
        ),
      ],
      apiRoutes: [apiRoute('POST', '/api/auth/forgot', source.usersAuthServer)],
    },
    requiredScenarios: [
      'Forgot password page renders.',
      'Valid reset request sends a deterministic reset email/stub.',
      'Invalid or unknown account request does not leak account existence.',
    ],
    relatedSpecs: [
      spec(
        'public-pages.spec.js',
        'forgot password page renders the recovery form',
      ),
    ],
  },
  {
    id: 'auth.password-reset',
    area: AREA.authAccount,
    status: STATUS.active,
    description: 'Visitors can reset their password with a valid token.',
    roles: ['visitor'],
    references: {
      clientRoutes: [
        clientRoute('reset', '/password/reset/:token', source.usersClient),
        clientRoute(
          'reset-success',
          '/password/reset/success',
          source.usersClient,
        ),
      ],
      apiRoutes: [
        apiRoute('GET', '/api/auth/reset/:token', source.usersAuthServer),
        apiRoute('POST', '/api/auth/reset/:token', source.usersAuthServer),
      ],
    },
    requiredScenarios: [
      'Valid reset token opens reset form.',
      'Password reset succeeds with matching valid passwords.',
      'Success page is shown after reset.',
      'Member can sign in with the new password.',
    ],
    relatedSpecs: [],
  },
  {
    id: 'auth.password-reset-invalid',
    area: AREA.authAccount,
    status: STATUS.active,
    description: 'Invalid password reset links show recovery guidance.',
    roles: ['visitor'],
    references: {
      clientRoutes: [
        clientRoute(
          'reset-invalid',
          '/password/reset/invalid',
          source.usersClient,
        ),
      ],
      apiRoutes: [
        apiRoute('GET', '/api/auth/reset/:token', source.usersAuthServer),
      ],
    },
    requiredScenarios: [
      'Invalid reset page explains that the link is no longer valid.',
      'Invalid reset page links back to password recovery.',
    ],
    relatedSpecs: [
      spec(
        'public-pages.spec.js',
        'invalid password reset page explains the link is no longer valid',
      ),
    ],
  },
  {
    id: 'account.password-change',
    area: AREA.authAccount,
    status: STATUS.active,
    description: 'Authenticated members can change their password.',
    roles: ['member'],
    references: {
      clientRoutes: [
        clientRoute(
          'profile-edit.account',
          '/profile/edit/account',
          source.usersClient,
          {
            requiresAuth: true,
          },
        ),
      ],
      apiRoutes: [apiRoute('POST', '/api/users/password', source.usersServer)],
    },
    requiredScenarios: [
      'Current password is required.',
      'Password change succeeds with valid current and new password.',
      'Validation errors are visible for invalid data.',
    ],
    relatedSpecs: [],
  },
  {
    id: 'account.details-update',
    area: AREA.authAccount,
    status: STATUS.active,
    description: 'Authenticated members can update account details.',
    roles: ['member'],
    references: {
      clientRoutes: [
        clientRoute(
          'profile-edit.account',
          '/profile/edit/account',
          source.usersClient,
          {
            requiresAuth: true,
          },
        ),
      ],
      apiRoutes: [apiRoute('PUT', '/api/users', source.usersServer)],
    },
    requiredScenarios: [
      'Account edit page is reachable.',
      'Valid account details update persists.',
      'Invalid account details show validation errors.',
    ],
    relatedSpecs: [
      spec('authenticated.spec.js', 'profile edit account page is reachable'),
    ],
  },
  {
    id: 'account.profile-removal',
    area: AREA.authAccount,
    status: STATUS.active,
    description: 'Members can request and confirm profile removal.',
    roles: ['member'],
    references: {
      clientRoutes: [
        clientRoute('remove', '/remove/:token', source.usersClient, {
          requiresAuth: true,
        }),
      ],
      apiRoutes: [
        apiRoute('DELETE', '/api/users', source.usersServer),
        apiRoute('DELETE', '/api/users/remove/:token', source.usersServer),
      ],
    },
    requiredScenarios: [
      'Removal request sends a deterministic confirmation email/stub.',
      'Valid removal token removes the profile.',
      'Invalid removal token is rejected.',
    ],
    relatedSpecs: [],
  },
  {
    id: 'account.oauth-providers',
    area: AREA.authAccount,
    status: STATUS.active,
    description:
      'Members can connect and disconnect Facebook, Twitter, and GitHub OAuth accounts via local stubs.',
    roles: ['member'],
    references: {
      clientRoutes: [
        clientRoute(
          'profile-edit.networks',
          '/profile/edit/networks',
          source.usersClient,
          {
            requiresAuth: true,
          },
        ),
      ],
      apiRoutes: [
        apiRoute('GET', '/api/auth/facebook', source.usersAuthServer),
        apiRoute('PUT', '/api/auth/facebook', source.usersAuthServer),
        apiRoute('GET', '/api/auth/facebook/callback', source.usersAuthServer),
        apiRoute('GET', '/api/auth/twitter', source.usersAuthServer),
        apiRoute('GET', '/api/auth/twitter/callback', source.usersAuthServer),
        apiRoute('GET', '/api/auth/github', source.usersAuthServer),
        apiRoute('GET', '/api/auth/github/callback', source.usersAuthServer),
        apiRoute('DELETE', '/api/users/accounts/:provider', source.usersServer),
      ],
    },
    requiredScenarios: [
      'Each OAuth provider can start and complete a stubbed callback flow.',
      'Connected OAuth provider can be disconnected.',
      'OAuth callback errors show user-facing error state.',
    ],
    relatedSpecs: [],
  },
  {
    id: 'account.push-registrations',
    area: AREA.authAccount,
    status: STATUS.active,
    description: 'Members can register and remove web push tokens.',
    roles: ['member'],
    references: {
      clientRoutes: [],
      apiRoutes: [
        apiRoute('POST', '/api/users/push/registrations', source.usersServer),
        apiRoute(
          'DELETE',
          '/api/users/push/registrations/:token',
          source.usersServer,
        ),
      ],
    },
    requiredScenarios: [
      'Push registration can be added with deterministic local permissions.',
      'Push registration can be removed.',
    ],
    relatedSpecs: [],
  },
  {
    id: 'profile.welcome-onboarding',
    area: AREA.profileOnboarding,
    status: STATUS.active,
    description:
      'Authenticated members can see the welcome/onboarding surface.',
    roles: ['member'],
    references: {
      clientRoutes: [
        clientRoute('welcome', '/welcome', source.usersClient, {
          requiresAuth: true,
        }),
      ],
      apiRoutes: [],
    },
    requiredScenarios: [
      'Welcome page loads for a newly authenticated member.',
      'Welcome/onboarding links guide the member to profile completion.',
    ],
    relatedSpecs: [],
  },
  {
    id: 'profile.signed-out-redirect',
    area: AREA.profileOnboarding,
    status: STATUS.active,
    description:
      'Visitors attempting to view member profiles are redirected to sign in.',
    roles: ['visitor'],
    references: {
      clientRoutes: [
        clientRoute('profile.about', '/profile/:username', source.usersClient, {
          requiresAuth: true,
        }),
      ],
      apiRoutes: [],
    },
    requiredScenarios: [
      'Signed-out profile access redirects to sign in.',
      'Redirect preserves enough context to continue after authentication when supported.',
    ],
    relatedSpecs: [
      spec(
        'seeded-content.spec.js',
        'viewing a host profile while signed out redirects to sign in',
      ),
    ],
  },
  {
    id: 'profile.signup-splash',
    area: AREA.profileOnboarding,
    status: STATUS.active,
    description:
      'Visitors can see the profile-signup splash page when that route is used.',
    roles: ['visitor'],
    references: {
      clientRoutes: [
        clientRoute('profile-signup', '/profile-signup', source.usersClient),
      ],
      apiRoutes: [],
    },
    requiredScenarios: [
      'Profile signup splash page loads for visitors.',
      'Splash page offers clear sign up and sign in actions.',
    ],
    relatedSpecs: [],
  },
  {
    id: 'profile.edit-about',
    area: AREA.profileOnboarding,
    status: STATUS.active,
    description: 'Members can edit profile basics/about content.',
    roles: ['member'],
    references: {
      clientRoutes: [
        clientRoute('profile-edit.about', '/profile/edit', source.usersClient, {
          requiresAuth: true,
        }),
      ],
      apiRoutes: [apiRoute('PUT', '/api/users', source.usersServer)],
    },
    requiredScenarios: [
      'About edit form is reachable.',
      'Valid profile changes persist and are visible on profile view.',
      'Validation errors are visible for invalid content.',
    ],
    relatedSpecs: [
      spec('authenticated.spec.js', 'profile edit "about" form is reachable'),
    ],
  },
  {
    id: 'profile.edit-locations',
    area: AREA.profileOnboarding,
    status: STATUS.active,
    description: 'Members can edit location information used by maps/search.',
    roles: ['member'],
    references: {
      clientRoutes: [
        clientRoute(
          'profile-edit.locations',
          '/profile/edit/locations',
          source.usersClient,
          { requiresAuth: true },
        ),
      ],
      apiRoutes: [apiRoute('PUT', '/api/users', source.usersServer)],
    },
    requiredScenarios: [
      'Locations edit form is reachable.',
      'Geocoding/map interactions are stubbed deterministically.',
      'Valid location changes persist.',
    ],
    relatedSpecs: [
      spec('authenticated.spec.js', 'profile edit locations page is reachable'),
    ],
  },
  {
    id: 'profile.edit-photo',
    area: AREA.profileOnboarding,
    status: STATUS.active,
    description: 'Members can upload, crop, view, and fall back from avatars.',
    roles: ['member'],
    references: {
      clientRoutes: [
        clientRoute(
          'profile-edit.photo',
          '/profile/edit/photo',
          source.usersClient,
          {
            requiresAuth: true,
          },
        ),
      ],
      apiRoutes: [
        apiRoute('POST', '/api/users-avatar', source.usersServer),
        apiRoute('GET', '/api/users/:avatarUserId/avatar', source.usersServer),
      ],
    },
    requiredScenarios: [
      'Photo edit page is reachable.',
      'Valid upload succeeds through deterministic file processing.',
      'Invalid upload shows an error.',
      'Avatar endpoint returns uploaded or fallback image.',
    ],
    relatedSpecs: [
      spec('authenticated.spec.js', 'profile edit photo page is reachable'),
      spec('authenticated.spec.js', 'member can upload a valid profile photo'),
      spec(
        'authenticated.spec.js',
        'invalid profile photo upload shows an error',
      ),
      spec(
        'authenticated.spec.js',
        'avatar endpoint returns uploaded or fallback image',
      ),
    ],
  },
  {
    id: 'profile.edit-networks',
    area: AREA.profileOnboarding,
    status: STATUS.active,
    description: 'Members can edit profile network links and Nostr public key.',
    roles: ['member'],
    references: {
      clientRoutes: [
        clientRoute(
          'profile-edit.networks',
          '/profile/edit/networks',
          source.usersClient,
          { requiresAuth: true },
        ),
      ],
      apiRoutes: [apiRoute('PUT', '/api/users', source.usersServer)],
    },
    requiredScenarios: [
      'Networks edit form is reachable.',
      'Invalid Nostr secret key is rejected.',
      'Valid npub is saved and shown on profile view.',
    ],
    relatedSpecs: [
      spec('authenticated.spec.js', 'profile edit networks page is reachable'),
      spec('member.spec.js', 'profile edit networks page is reachable'),
      spec(
        'nostr.spec.js',
        'shows a validation error when a secret key is entered',
      ),
      spec(
        'nostr.spec.js',
        'saves a valid npub and persists it across reloads',
      ),
      spec(
        'nostr.spec.js',
        'links the saved npub to njump.me on the profile view',
      ),
    ],
  },
  {
    id: 'profile.view-about',
    area: AREA.profileOnboarding,
    status: STATUS.active,
    description:
      'Members can view their own and another member profile about tab.',
    roles: ['member'],
    references: {
      clientRoutes: [
        clientRoute('profile.about', '/profile/:username', source.usersClient, {
          requiresAuth: true,
        }),
      ],
      apiRoutes: [apiRoute('GET', '/api/users/:username', source.usersServer)],
    },
    requiredScenarios: [
      'Own profile about tab loads.',
      'Other member profile about tab loads.',
      'Profile API returns public profile data.',
    ],
    relatedSpecs: [
      spec('authenticated.spec.js', 'member can view their own profile'),
      spec('authenticated.spec.js', 'member can view a seeded host profile'),
      spec(
        'member.spec.js',
        'another host profile shows their about description',
      ),
      spec('member.spec.js', 'seeded host profile API returns profile data'),
    ],
  },
  {
    id: 'profile.view-overview',
    area: AREA.profileOnboarding,
    status: STATUS.active,
    description: 'Members can view profile overview/basics.',
    roles: ['member'],
    references: {
      clientRoutes: [
        clientRoute(
          'profile.overview',
          '/profile/:username/overview',
          source.usersClient,
          { requiresAuth: true },
        ),
      ],
      apiRoutes: [apiRoute('GET', '/api/users/:username', source.usersServer)],
    },
    requiredScenarios: [
      'Own overview tab loads.',
      'Other member overview tab loads.',
    ],
    relatedSpecs: [
      spec(
        'member.spec.js',
        'third seeded host profile is visible to signed-in members',
      ),
    ],
  },
  {
    id: 'profile.view-accommodation',
    area: AREA.profileOnboarding,
    status: STATUS.active,
    description: 'Members can view accommodation/hosting details on profiles.',
    roles: ['member'],
    references: {
      clientRoutes: [
        clientRoute(
          'profile.accommodation',
          '/profile/:username/accommodation',
          source.usersClient,
          { requiresAuth: true },
        ),
      ],
      apiRoutes: [apiRoute('GET', '/api/users/:username', source.usersServer)],
    },
    requiredScenarios: [
      'Accommodation tab loads for a host.',
      'Hosting details from seeded offer/profile are visible.',
    ],
    relatedSpecs: [
      spec(
        'member.spec.js',
        'another host accommodation page shows hosting details',
      ),
    ],
  },
  {
    id: 'profile.view-contacts',
    area: AREA.profileOnboarding,
    status: STATUS.active,
    description: 'Members can view contacts on profile tabs.',
    roles: ['member'],
    references: {
      clientRoutes: [
        clientRoute(
          'profile.contacts',
          '/profile/:username/contacts',
          source.usersClient,
          { requiresAuth: true },
        ),
      ],
      apiRoutes: [
        apiRoute('GET', '/api/contacts/:listUserId', source.contactsServer),
      ],
    },
    requiredScenarios: [
      'Own contacts tab can show empty state.',
      'Other member contacts tab can list contacts when present.',
    ],
    relatedSpecs: [
      spec('member.spec.js', 'own contacts page shows the empty state'),
    ],
  },
  {
    id: 'profile.view-circles',
    area: AREA.profileOnboarding,
    status: STATUS.active,
    description: 'Members can view joined circles on profile tabs.',
    roles: ['member'],
    references: {
      clientRoutes: [
        clientRoute(
          'profile.tribes',
          '/profile/:username/tribes',
          source.usersClient,
          {
            requiresAuth: true,
          },
        ),
      ],
      apiRoutes: [
        apiRoute('GET', '/api/users/memberships', source.usersServer),
      ],
    },
    requiredScenarios: [
      'Own profile lists joined circles.',
      'Profile circles tab lists joined circles.',
    ],
    relatedSpecs: [
      spec('member.spec.js', 'own profile lists joined circles'),
      spec('member.spec.js', 'profile tribes tab lists joined circles'),
    ],
  },
  {
    id: 'profile.visibility-hidden-users',
    area: AREA.profileOnboarding,
    status: STATUS.active,
    description:
      'Missing, suspended, shadowbanned, or otherwise hidden profiles are not exposed to regular members.',
    roles: ['member', 'shadowbanned-member'],
    references: {
      clientRoutes: [
        clientRoute('profile.about', '/profile/:username', source.usersClient, {
          requiresAuth: true,
        }),
      ],
      apiRoutes: [apiRoute('GET', '/api/users/:username', source.usersServer)],
    },
    requiredScenarios: [
      'Missing profile shows user-not-found UI.',
      'Shadowbanned profile is hidden in browser view.',
      'Shadowbanned profile is hidden through profile API.',
    ],
    relatedSpecs: [
      spec(
        'member.spec.js',
        'shadowbanned member profiles are hidden from other members',
      ),
      spec(
        'member.spec.js',
        'members cannot load a shadowbanned profile through the API',
      ),
    ],
  },
  {
    id: 'search.map',
    area: AREA.searchOffersCircles,
    status: STATUS.active,
    description:
      'Confirmed members can use map search with location, offer, and circle filters.',
    roles: ['confirmed-member'],
    references: {
      clientRoutes: [
        clientRoute(
          'search.map',
          '/search?location?offer?tribe',
          source.searchClient,
          {
            requiresAuth: true,
          },
        ),
      ],
      apiRoutes: [
        apiRoute('GET', '/api/offers', source.offersServer),
        apiRoute('GET', '/api/offers/:offerId', source.offersServer),
        apiRoute('GET', '/api/tribes/:tribe', source.tribesServer),
      ],
    },
    requiredScenarios: [
      'Search map loads for a signed-in member.',
      'Location bounding-box query returns seeded offers.',
      'Offer deep-link query resolves the selected offer.',
      'Circle filter query resolves the selected circle.',
      'Search map renders with deterministic offline style.',
      'Route fixture offers populate the rendered map source.',
      'Empty map-offers fixture leaves the search map usable.',
      'Rendered map offer deep-link opens deterministic sidebar data.',
    ],
    relatedSpecs: [
      spec('authenticated.spec.js', 'search page loads for a signed in member'),
      spec('member.spec.js', 'map offers API returns seeded hosts in Europe'),
      spec(
        'search-map-rendered.spec.js',
        'search map renders with offline style and fixture offers',
      ),
      spec(
        'search-map-rendered.spec.js',
        'search map stays usable when offers fixture is empty',
      ),
      spec(
        'search-map-rendered.spec.js',
        'offer deep-link uses fixture offer data in the sidebar',
      ),
    ],
  },
  {
    id: 'search.members',
    area: AREA.searchOffersCircles,
    status: STATUS.active,
    description: 'Members can search other members by text.',
    roles: ['member'],
    references: {
      clientRoutes: [
        clientRoute('search-users', '/search/members', source.searchClient, {
          requiresAuth: true,
        }),
      ],
      apiRoutes: [apiRoute('GET', '/api/users', source.usersServer)],
    },
    requiredScenarios: [
      'Search members page loads.',
      'Search returns seeded hosts.',
      'Search handles empty or no-result states.',
    ],
    relatedSpecs: [
      spec('authenticated.spec.js', 'search members page loads'),
      spec('authenticated.spec.js', 'search members page finds seeded hosts'),
    ],
  },
  {
    id: 'offers.host',
    area: AREA.searchOffersCircles,
    status: STATUS.active,
    description:
      'Confirmed members can create, edit, publish, and remove host offers.',
    roles: ['confirmed-member'],
    references: {
      clientRoutes: [
        clientRoute(
          'offer.host.edit',
          '/offer/host?status',
          source.offersClient,
          {
            requiresAuth: true,
          },
        ),
      ],
      apiRoutes: [
        apiRoute('GET', '/api/offers-by/:offerUserId', source.offersServer),
        apiRoute('POST', '/api/offers', source.offersServer),
        apiRoute('PUT', '/api/offers/:offerId', source.offersServer),
        apiRoute('DELETE', '/api/offers/:offerId', source.offersServer),
      ],
    },
    requiredScenarios: [
      'Host offer edit page loads.',
      'Member can create/update a host offer.',
      'Host offer visibility appears in profile/search.',
      'Member can remove or disable a host offer.',
    ],
    relatedSpecs: [
      spec(
        'member.spec.js',
        'host offer edit page loads for a confirmed member',
      ),
    ],
  },
  {
    id: 'offers.meet-list',
    area: AREA.searchOffersCircles,
    status: STATUS.active,
    description: 'Members can list their meet offers and see empty state.',
    roles: ['member'],
    references: {
      clientRoutes: [
        clientRoute('offer.meet.list', '/offer/meet', source.offersClient, {
          requiresAuth: true,
        }),
      ],
      apiRoutes: [
        apiRoute('GET', '/api/offers-by/:offerUserId', source.offersServer),
      ],
    },
    requiredScenarios: [
      'Meet offers list page loads.',
      'Empty state is shown when member has no meet offers.',
      'Existing meet offers are listed with edit links.',
    ],
    relatedSpecs: [
      spec('member.spec.js', 'meet offers list page shows the empty state'),
    ],
  },
  {
    id: 'offers.meet-create-edit-delete',
    area: AREA.searchOffersCircles,
    status: STATUS.active,
    description: 'Members can add, edit, expire, and delete meet offers.',
    roles: ['member'],
    references: {
      clientRoutes: [
        clientRoute('offer.meet.add', '/offer/meet/add', source.offersClient, {
          requiresAuth: true,
        }),
        clientRoute(
          'offer.meet.edit',
          '/offer/meet/:offerId',
          source.offersClient,
          {
            requiresAuth: true,
          },
        ),
      ],
      apiRoutes: [
        apiRoute('POST', '/api/offers', source.offersServer),
        apiRoute('GET', '/api/offers/:offerId', source.offersServer),
        apiRoute('PUT', '/api/offers/:offerId', source.offersServer),
        apiRoute('DELETE', '/api/offers/:offerId', source.offersServer),
      ],
    },
    requiredScenarios: [
      'Meet offer add form loads.',
      'Valid meet offer can be created.',
      'Existing meet offer can be edited.',
      'Expired meet offer behavior is visible.',
      'Meet offer can be deleted.',
    ],
    relatedSpecs: [],
  },
  {
    id: 'offers.legacy-parent-redirect',
    area: AREA.searchOffersCircles,
    status: STATUS.active,
    description:
      'Abstract /offer parent route redirects to host offer editing.',
    roles: ['member'],
    references: {
      clientRoutes: [
        clientRoute('offer', '/offer', source.offersClient, {
          requiresAuth: true,
          redirectTo: '/offer/host',
        }),
      ],
      apiRoutes: [],
    },
    requiredScenarios: ['/offer redirects to /offer/host.'],
    relatedSpecs: [],
  },
  {
    id: 'circles.list',
    area: AREA.searchOffersCircles,
    status: STATUS.active,
    description: 'Visitors and members can browse public circles.',
    roles: ['visitor', 'member'],
    references: {
      clientRoutes: [
        clientRoute('circles.list', '/circles', source.tribesClient),
      ],
      apiRoutes: [apiRoute('GET', '/api/tribes', source.tribesServer)],
    },
    requiredScenarios: [
      'Circles list loads for visitors.',
      'Circles list loads for signed-in members.',
      'Tribes API returns seeded circles.',
    ],
    relatedSpecs: [
      spec('public-pages.spec.js', 'circles page lists seeded tribes'),
      spec(
        'authenticated.spec.js',
        'logged in member can browse circles while unconfirmed',
      ),
      spec('seeded-content.spec.js', 'tribes API returns seeded circles'),
    ],
  },
  {
    id: 'circles.detail',
    area: AREA.searchOffersCircles,
    status: STATUS.active,
    description: 'Visitors and members can view a circle detail page.',
    roles: ['visitor', 'member'],
    references: {
      clientRoutes: [
        clientRoute('circles.circle', '/circles/:circle', source.tribesClient),
      ],
      apiRoutes: [apiRoute('GET', '/api/tribes/:tribe', source.tribesServer)],
    },
    requiredScenarios: [
      'Seeded circle detail page loads.',
      'Unknown circle shows a user-facing error or not found state.',
    ],
    relatedSpecs: [
      spec(
        'seeded-content.spec.js',
        'circle detail page loads for a seeded tribe',
      ),
    ],
  },
  {
    id: 'circles.join-leave',
    area: AREA.searchOffersCircles,
    status: STATUS.active,
    description: 'Members can join and leave circles.',
    roles: ['member'],
    references: {
      clientRoutes: [
        clientRoute('circles.list', '/circles', source.tribesClient),
        clientRoute('circles.circle', '/circles/:circle', source.tribesClient),
      ],
      apiRoutes: [
        apiRoute('GET', '/api/users/memberships', source.usersServer),
        apiRoute('POST', '/api/users/memberships/:tribeId', source.usersServer),
        apiRoute(
          'DELETE',
          '/api/users/memberships/:tribeId',
          source.usersServer,
        ),
      ],
    },
    requiredScenarios: [
      'Member can join an additional circle.',
      'Member can leave a joined circle.',
      'Membership updates are reflected on profile and circle list.',
    ],
    relatedSpecs: [
      spec(
        'member.spec.js',
        'member can join an additional circle from the circles page',
      ),
    ],
  },
  {
    id: 'circles.signup-suggestions',
    area: AREA.searchOffersCircles,
    status: STATUS.active,
    description: 'Signup can suggest circles using the tribe query parameter.',
    roles: ['visitor'],
    references: {
      clientRoutes: [
        clientRoute('signup', '/signup?tribe', source.usersClient),
      ],
      apiRoutes: [
        apiRoute('GET', '/api/tribes', source.tribesServer),
        apiRoute('GET', '/api/tribes/:tribe', source.tribesServer),
      ],
    },
    requiredScenarios: [
      'Signup with tribe query preloads the suggested circle.',
      'Invalid tribe query falls back gracefully.',
    ],
    relatedSpecs: [],
  },
  {
    id: 'contacts.add',
    area: AREA.relationshipsSafety,
    status: STATUS.active,
    description: 'Members can add another member as a contact.',
    roles: ['member'],
    references: {
      clientRoutes: [
        clientRoute(
          'contactAdd',
          '/contact-add/:userId',
          source.contactsClient,
          {
            requiresAuth: true,
          },
        ),
      ],
      apiRoutes: [
        apiRoute('POST', '/api/contact', source.contactsServer),
        apiRoute(
          'GET',
          '/api/contact-by/:contactUserId',
          source.contactsServer,
        ),
        apiRoute('GET', '/api/users/mini/:userId', source.usersServer),
      ],
    },
    requiredScenarios: [
      'Add contact page loads for an eligible member.',
      'Adding a new contact creates a pending relationship.',
      'Already-added contact state is handled.',
    ],
    relatedSpecs: [],
  },
  {
    id: 'contacts.confirm',
    area: AREA.relationshipsSafety,
    status: STATUS.active,
    description: 'Members can confirm a pending contact request.',
    roles: ['member'],
    references: {
      clientRoutes: [
        clientRoute(
          'contactConfirm',
          '/contact-confirm/:contactId',
          source.contactsClient,
          { requiresAuth: true },
        ),
      ],
      apiRoutes: [
        apiRoute('GET', '/api/contact/:contactId', source.contactsServer),
        apiRoute('PUT', '/api/contact/:contactId', source.contactsServer),
      ],
    },
    requiredScenarios: [
      'Confirm contact page loads for a pending contact.',
      'Confirming the contact makes the relationship mutual/confirmed.',
      'Invalid or unauthorized contact confirmation is denied.',
    ],
    relatedSpecs: [],
  },
  {
    id: 'contacts.remove',
    area: AREA.relationshipsSafety,
    status: STATUS.active,
    description: 'Members can remove contacts.',
    roles: ['member'],
    references: {
      clientRoutes: [
        clientRoute(
          'profile.contacts',
          '/profile/:username/contacts',
          source.usersClient,
          {
            requiresAuth: true,
          },
        ),
      ],
      apiRoutes: [
        apiRoute('DELETE', '/api/contact/:contactId', source.contactsServer),
      ],
    },
    requiredScenarios: [
      'Confirmed contact can be removed.',
      'Removed contact no longer appears in contact lists.',
    ],
    relatedSpecs: [],
  },
  {
    id: 'contacts.lists-and-common',
    area: AREA.relationshipsSafety,
    status: STATUS.active,
    description: 'Members can view contact lists and common contacts.',
    roles: ['member'],
    references: {
      clientRoutes: [
        clientRoute(
          'profile.contacts',
          '/profile/:username/contacts',
          source.usersClient,
          {
            requiresAuth: true,
          },
        ),
      ],
      apiRoutes: [
        apiRoute('GET', '/api/contacts/:listUserId', source.contactsServer),
        apiRoute(
          'GET',
          '/api/contacts/:listUserId/common',
          source.contactsServer,
        ),
      ],
    },
    requiredScenarios: [
      'Contact list empty state is visible.',
      'Contact list shows confirmed contacts.',
      'Common contacts endpoint filters to shared contacts.',
    ],
    relatedSpecs: [
      spec('member.spec.js', 'own contacts page shows the empty state'),
    ],
  },
  {
    id: 'safety.block-users',
    area: AREA.relationshipsSafety,
    status: STATUS.active,
    description: 'Members can list, block, and unblock other users.',
    roles: ['member'],
    references: {
      clientRoutes: [
        clientRoute('profile.about', '/profile/:username', source.usersClient, {
          requiresAuth: true,
        }),
      ],
      apiRoutes: [
        apiRoute('GET', '/api/blocked-users', source.usersBlockServer),
        apiRoute(
          'PUT',
          '/api/blocked-users/:username',
          source.usersBlockServer,
        ),
        apiRoute(
          'DELETE',
          '/api/blocked-users/:username',
          source.usersBlockServer,
        ),
      ],
    },
    requiredScenarios: [
      'Blocked users list loads.',
      'Member can block another user from profile/safety UI.',
      'Member can unblock a blocked user.',
    ],
    relatedSpecs: [],
  },
  {
    id: 'safety.block-effects',
    area: AREA.relationshipsSafety,
    status: STATUS.active,
    description:
      'Blocking changes profile, messaging, and contact actions as users expect.',
    roles: ['member'],
    references: {
      clientRoutes: [
        clientRoute('profile.about', '/profile/:username', source.usersClient, {
          requiresAuth: true,
        }),
        clientRoute(
          'messageThread',
          '/messages/:username?userId',
          source.messagesClient,
          {
            requiresAuth: true,
          },
        ),
      ],
      apiRoutes: [
        apiRoute(
          'PUT',
          '/api/blocked-users/:username',
          source.usersBlockServer,
        ),
        apiRoute('POST', '/api/messages', source.messagesServer),
        apiRoute('POST', '/api/contact', source.contactsServer),
      ],
    },
    requiredScenarios: [
      'Blocked profile actions are hidden or disabled.',
      'Blocked users cannot start or continue conversations where prohibited.',
    ],
    relatedSpecs: [],
  },
  {
    id: 'safety.shadowban-hiding',
    area: AREA.relationshipsSafety,
    status: STATUS.active,
    description:
      'Shadowbanned members are hidden from public/member-facing profile, search, and message surfaces.',
    roles: ['member', 'shadowbanned-member', 'admin'],
    references: {
      clientRoutes: [
        clientRoute('profile.about', '/profile/:username', source.usersClient, {
          requiresAuth: true,
        }),
        clientRoute('inbox', '/messages', source.messagesClient, {
          requiresAuth: true,
        }),
      ],
      apiRoutes: [
        apiRoute('GET', '/api/users/:username', source.usersServer),
        apiRoute('GET', '/api/messages', source.messagesServer),
        apiRoute('GET', '/api/messages/:messageUserId', source.messagesServer),
      ],
    },
    requiredScenarios: [
      'Shadowbanned profile is hidden from members.',
      'Shadow-hidden messages are not visible to regular recipients.',
      'Admin tools can still inspect shadow-hidden content.',
    ],
    relatedSpecs: [
      spec(
        'member.spec.js',
        'shadowbanned member profiles are hidden from other members',
      ),
      spec('messages.spec.js', 'inbox does not list the shadowbanned sender'),
      spec(
        'messages-api.spec.js',
        'member thread API hides shadow-hidden messages from the recipient',
      ),
      spec(
        'admin-inspection.spec.js',
        'admin messages tool shows shadow-hidden messages between members',
      ),
    ],
  },
  {
    id: 'messages.inbox',
    area: AREA.messages,
    status: STATUS.active,
    description: 'Members can open the inbox and see conversations.',
    roles: ['member'],
    references: {
      clientRoutes: [
        clientRoute('inbox', '/messages', source.messagesClient, {
          requiresAuth: true,
        }),
      ],
      apiRoutes: [apiRoute('GET', '/api/messages', source.messagesServer)],
    },
    requiredScenarios: [
      'Inbox lists seeded conversation.',
      'Inbox empty state is visible when there are no conversations.',
      'Inbox excludes shadow-hidden conversations.',
    ],
    relatedSpecs: [
      spec(
        'messages.spec.js',
        'inbox lists the seeded conversation with Portland Host',
      ),
      spec(
        'messages-api.spec.js',
        'inbox API returns sanitized thread excerpts',
      ),
      spec('messages.spec.js', 'inbox does not list the shadowbanned sender'),
    ],
  },
  {
    id: 'messages.thread-open',
    area: AREA.messages,
    status: STATUS.active,
    description: 'Members can open existing conversation threads.',
    roles: ['member'],
    references: {
      clientRoutes: [
        clientRoute(
          'messageThread',
          '/messages/:username?userId',
          source.messagesClient,
          {
            requiresAuth: true,
          },
        ),
      ],
      apiRoutes: [
        apiRoute('GET', '/api/messages/:messageUserId', source.messagesServer),
      ],
    },
    requiredScenarios: [
      'Thread view opens from inbox.',
      'Thread view shows seeded replies.',
      'Thread can be opened by username or userId route/query.',
    ],
    relatedSpecs: [
      spec('messages.spec.js', 'thread view shows the seeded reply'),
      spec('member.spec.js', 'inbox thread opens the conversation view'),
    ],
  },
  {
    id: 'messages.new-conversation',
    area: AREA.messages,
    status: STATUS.active,
    description:
      'Members can start a new conversation from profile/message actions.',
    roles: ['member'],
    references: {
      clientRoutes: [
        clientRoute(
          'messageThread',
          '/messages/:username?userId',
          source.messagesClient,
          {
            requiresAuth: true,
          },
        ),
        clientRoute('profile.about', '/profile/:username', source.usersClient, {
          requiresAuth: true,
        }),
      ],
      apiRoutes: [apiRoute('POST', '/api/messages', source.messagesServer)],
    },
    requiredScenarios: [
      'Profile action links to a new message thread.',
      'New thread empty state is visible.',
      'Sending an opening message creates the conversation.',
    ],
    relatedSpecs: [
      spec(
        'member.spec.js',
        'profile actions link to messaging and experiences',
      ),
      spec(
        'member.spec.js',
        'new message thread shows the empty conversation state',
      ),
    ],
  },
  {
    id: 'messages.reply-send',
    area: AREA.messages,
    status: STATUS.active,
    description: 'Members can reply in existing threads.',
    roles: ['member'],
    references: {
      clientRoutes: [
        clientRoute(
          'messageThread',
          '/messages/:username?userId',
          source.messagesClient,
          {
            requiresAuth: true,
          },
        ),
      ],
      apiRoutes: [apiRoute('POST', '/api/messages', source.messagesServer)],
    },
    requiredScenarios: [
      'Reply composer is visible in an existing thread.',
      'Sending a reply appends it to the thread.',
      'Validation prevents empty or forbidden replies.',
    ],
    relatedSpecs: [
      spec(
        'messages-api.spec.js',
        'message send API rejects invalid recipients',
      ),
    ],
  },
  {
    id: 'messages.read-count-sync',
    area: AREA.messages,
    status: STATUS.active,
    description: 'Unread counts, mark-read, and message sync stay consistent.',
    roles: ['member'],
    references: {
      clientRoutes: [
        clientRoute('inbox', '/messages', source.messagesClient, {
          requiresAuth: true,
        }),
        clientRoute(
          'messageThread',
          '/messages/:username?userId',
          source.messagesClient,
          {
            requiresAuth: true,
          },
        ),
      ],
      apiRoutes: [
        apiRoute('POST', '/api/messages-read', source.messagesServer),
        apiRoute('GET', '/api/messages-count', source.messagesServer),
        apiRoute('GET', '/api/messages-sync', source.messagesServer),
      ],
    },
    requiredScenarios: [
      'Unread count changes after opening or marking a thread read.',
      'Message sync endpoint returns deterministic updates.',
      'Sync handles no-new-message state.',
    ],
    relatedSpecs: [
      spec(
        'messages-api.spec.js',
        'message status APIs expose unread and sync payloads',
      ),
      spec(
        'messages-api.spec.js',
        'message read and sync APIs validate request payloads',
      ),
    ],
  },
  {
    id: 'messages.unconfirmed-restrictions',
    area: AREA.messages,
    status: STATUS.active,
    description:
      'Unconfirmed members see activation restrictions for messaging.',
    roles: ['unconfirmed-member'],
    references: {
      clientRoutes: [
        clientRoute('inbox', '/messages', source.messagesClient, {
          requiresAuth: true,
        }),
      ],
      apiRoutes: [apiRoute('GET', '/api/messages', source.messagesServer)],
    },
    requiredScenarios: [
      'Unconfirmed member opening inbox is prompted to activate profile.',
      'Restricted message actions are unavailable until confirmation.',
    ],
    relatedSpecs: [
      spec(
        'authenticated.spec.js',
        'inbox prompts an unconfirmed member to activate their profile',
      ),
    ],
  },
  {
    id: 'experiences.profile-list',
    area: AREA.experiencesReferences,
    status: STATUS.active,
    description: 'Members can view public experiences on profile tabs.',
    roles: ['member'],
    references: {
      clientRoutes: [
        clientRoute(
          'profile.experiences.list',
          '/profile/:username/experiences',
          source.usersClient,
          { requiresAuth: true, featureFlag: 'referencesEnabled' },
        ),
      ],
      apiRoutes: [
        apiRoute('GET', '/api/experiences', source.experiencesServer, {
          featureFlag: 'reference',
        }),
      ],
    },
    requiredScenarios: [
      'Profile experiences tab is reachable.',
      'Seeded public experience is displayed.',
      'Experiences API returns public experiences for a member.',
    ],
    relatedSpecs: [
      spec(
        'member.spec.js',
        'profile experiences tab is reachable from another member profile',
      ),
      spec(
        'experiences.spec.js',
        'profile experiences tab shows the seeded public experience',
      ),
      spec(
        'experiences.spec.js',
        'experiences API returns the seeded public experience',
      ),
    ],
  },
  {
    id: 'experiences.create',
    area: AREA.experiencesReferences,
    status: STATUS.active,
    description: 'Members can create experiences for other members.',
    roles: ['member'],
    references: {
      clientRoutes: [
        clientRoute(
          'profile.experiences.new',
          '/profile/:username/experiences/new',
          source.usersClient,
          { requiresAuth: true, featureFlag: 'referencesEnabled' },
        ),
      ],
      apiRoutes: [
        apiRoute('POST', '/api/experiences', source.experiencesServer, {
          featureFlag: 'reference',
        }),
      ],
    },
    requiredScenarios: [
      'Experience form opens from profile actions.',
      'Valid public experience can be submitted.',
      'Valid private experience can be submitted when supported.',
      'Validation errors are shown for invalid submissions.',
    ],
    relatedSpecs: [
      spec(
        'member.spec.js',
        'profile actions link to messaging and experiences',
      ),
    ],
  },
  {
    id: 'experiences.duplicate-prevention',
    area: AREA.experiencesReferences,
    status: STATUS.active,
    description:
      'Members cannot create duplicate experiences for the same member.',
    roles: ['member'],
    references: {
      clientRoutes: [
        clientRoute(
          'profile.experiences.new',
          '/profile/:username/experiences/new',
          source.usersClient,
          { requiresAuth: true, featureFlag: 'referencesEnabled' },
        ),
      ],
      apiRoutes: [
        apiRoute('GET', '/api/my-experience', source.experiencesServer, {
          featureFlag: 'reference',
        }),
      ],
    },
    requiredScenarios: [
      'Existing experience is detected.',
      'Duplicate create form shows the already-shared state.',
    ],
    relatedSpecs: [
      spec(
        'member.spec.js',
        'experience form shows duplicate when already shared',
      ),
    ],
  },
  {
    id: 'experiences.counts-and-details',
    area: AREA.experiencesReferences,
    status: STATUS.active,
    description: 'Experience count and detail APIs support profile summaries.',
    roles: ['member'],
    references: {
      clientRoutes: [
        clientRoute(
          'profile.experiences.list',
          '/profile/:username/experiences',
          source.usersClient,
          { requiresAuth: true, featureFlag: 'referencesEnabled' },
        ),
      ],
      apiRoutes: [
        apiRoute('GET', '/api/experiences/count', source.experiencesServer, {
          featureFlag: 'reference',
        }),
        apiRoute(
          'GET',
          '/api/experiences/:experienceId',
          source.experiencesServer,
          { featureFlag: 'reference' },
        ),
      ],
    },
    requiredScenarios: [
      'Experience counts match seeded public/private visibility.',
      'Experience detail API returns an authorized experience.',
      'Unauthorized or hidden experience detail is denied.',
    ],
    relatedSpecs: [],
  },
  {
    id: 'references.thread-create-read',
    area: AREA.experiencesReferences,
    status: STATUS.active,
    description:
      'Legacy reference thread APIs can create and read supported threads.',
    roles: ['member'],
    references: {
      clientRoutes: [],
      apiRoutes: [
        apiRoute(
          'GET',
          '/api/references-thread/:referenceThreadUserToId',
          source.referencesThreadServer,
        ),
        apiRoute(
          'POST',
          '/api/references-thread',
          source.referencesThreadServer,
        ),
      ],
    },
    requiredScenarios: [
      'Supported reference thread can be created.',
      'Supported reference thread can be read by an authorized member.',
      'Unauthorized reference thread access is denied.',
    ],
    relatedSpecs: [],
  },
  {
    id: 'experiences.disabled-state',
    area: AREA.experiencesReferences,
    status: STATUS.active,
    description:
      'Experience UI handles the references feature flag being disabled.',
    roles: ['member'],
    references: {
      clientRoutes: [
        clientRoute(
          'profile.experiences.list',
          '/profile/:username/experiences',
          source.usersClient,
          { requiresAuth: true, featureFlag: 'referencesEnabled' },
        ),
        clientRoute(
          'profile.experiences.new',
          '/profile/:username/experiences/new',
          source.usersClient,
          { requiresAuth: true, featureFlag: 'referencesEnabled' },
        ),
      ],
      apiRoutes: [],
    },
    requiredScenarios: [
      'Experiences tab hides or degrades safely when references are disabled.',
      'Create experience entry point is unavailable when references are disabled.',
    ],
    relatedSpecs: [],
  },
  {
    id: 'admin.dashboard',
    area: AREA.adminModeration,
    status: STATUS.active,
    description: 'Admins can load the admin dashboard; non-admins cannot.',
    roles: ['admin', 'member'],
    references: {
      clientRoutes: [
        clientRoute('admin', '/admin', source.adminClient, {
          requiresAuth: true,
          requiresRole: 'admin',
        }),
      ],
      apiRoutes: [],
    },
    requiredScenarios: [
      'Admin dashboard loads for admin.',
      'Regular member is denied access to admin tools.',
    ],
    relatedSpecs: [
      spec(
        'admin-pages.spec.js',
        'admin dashboard welcomes the signed in admin',
      ),
      spec(
        'authenticated.spec.js',
        'regular members are turned away from admin tools',
      ),
    ],
  },
  {
    id: 'admin.audit-log',
    area: AREA.adminModeration,
    status: STATUS.active,
    description: 'Admins can view audit log entries.',
    roles: ['admin'],
    references: {
      clientRoutes: [
        clientRoute('admin-audit-log', '/admin/audit-log', source.adminClient, {
          requiresAuth: true,
          requiresRole: 'admin',
        }),
      ],
      apiRoutes: [apiRoute('GET', '/api/admin/audit-log', source.adminServer)],
    },
    requiredScenarios: [
      'Audit log page loads.',
      'Audit log API returns deterministic entries.',
    ],
    relatedSpecs: [spec('admin-pages.spec.js', 'admin audit log page loads')],
  },
  {
    id: 'admin.acquisition-stories',
    area: AREA.adminModeration,
    status: STATUS.active,
    description: 'Admins can query acquisition stories.',
    roles: ['admin'],
    references: {
      clientRoutes: [
        clientRoute(
          'admin-acquisition-stories',
          '/admin/acquisition-stories',
          source.adminClient,
          { requiresAuth: true, requiresRole: 'admin' },
        ),
      ],
      apiRoutes: [
        apiRoute('POST', '/api/admin/acquisition-stories', source.adminServer),
      ],
    },
    requiredScenarios: [
      'Acquisition stories page loads.',
      'Acquisition stories query returns deterministic rows.',
    ],
    relatedSpecs: [],
  },
  {
    id: 'admin.acquisition-analysis',
    area: AREA.adminModeration,
    status: STATUS.active,
    description: 'Admins can view acquisition story analysis.',
    roles: ['admin'],
    references: {
      clientRoutes: [
        clientRoute(
          'admin-acquisition-stories-analysis',
          '/admin/acquisition-stories/analysis',
          source.adminClient,
          { requiresAuth: true, requiresRole: 'admin' },
        ),
      ],
      apiRoutes: [
        apiRoute(
          'POST',
          '/api/admin/acquisition-stories/analysis',
          source.adminServer,
        ),
      ],
    },
    requiredScenarios: [
      'Acquisition story analysis page loads.',
      'Analysis API returns deterministic analysis.',
    ],
    relatedSpecs: [],
  },
  {
    id: 'admin.messages',
    area: AREA.adminModeration,
    status: STATUS.active,
    description: 'Admins can inspect messages between members.',
    roles: ['admin'],
    references: {
      clientRoutes: [
        clientRoute('admin-messages', '/admin/messages', source.adminClient, {
          requiresAuth: true,
          requiresRole: 'admin',
        }),
      ],
      apiRoutes: [apiRoute('POST', '/api/admin/messages', source.adminServer)],
    },
    requiredScenarios: [
      'Admin messages page loads.',
      'Admin can query messages between two users.',
      'Shadow-hidden messages are visible to admin.',
    ],
    relatedSpecs: [
      spec(
        'admin-inspection.spec.js',
        'admin messages tool shows shadow-hidden messages between members',
      ),
    ],
  },
  {
    id: 'admin.threads',
    area: AREA.adminModeration,
    status: STATUS.active,
    description: 'Admins can query message threads.',
    roles: ['admin'],
    references: {
      clientRoutes: [
        clientRoute('admin-threads', '/admin/threads', source.adminClient, {
          requiresAuth: true,
          requiresRole: 'admin',
        }),
      ],
      apiRoutes: [apiRoute('POST', '/api/admin/threads', source.adminServer)],
    },
    requiredScenarios: [
      'Admin threads page loads.',
      'Admin can query threads by username/user id.',
    ],
    relatedSpecs: [spec('admin-pages.spec.js', 'admin threads page loads')],
  },
  {
    id: 'admin.search-users',
    area: AREA.adminModeration,
    status: STATUS.active,
    description: 'Admins can search users and inspect role state.',
    roles: ['admin'],
    references: {
      clientRoutes: [
        clientRoute(
          'admin-search-users',
          '/admin/search-users',
          source.adminClient,
          { requiresAuth: true, requiresRole: 'admin' },
        ),
      ],
      apiRoutes: [apiRoute('POST', '/api/admin/users', source.adminServer)],
    },
    requiredScenarios: [
      'Admin search finds a confirmed member.',
      'Admin search finds a shadowbanned member.',
      'Search handles no-result state.',
    ],
    relatedSpecs: [
      spec(
        'admin-search.spec.js',
        'admin search finds a confirmed seeded member',
      ),
      spec(
        'admin-search.spec.js',
        'admin search finds the shadowbanned member',
      ),
    ],
  },
  {
    id: 'admin.list-users-by-role',
    area: AREA.adminModeration,
    status: STATUS.active,
    description: 'Admins can list users by role.',
    roles: ['admin'],
    references: {
      clientRoutes: [
        clientRoute(
          'admin-search-users',
          '/admin/search-users',
          source.adminClient,
          { requiresAuth: true, requiresRole: 'admin' },
        ),
      ],
      apiRoutes: [
        apiRoute('POST', '/api/admin/users/by-role', source.adminServer),
      ],
    },
    requiredScenarios: [
      'Admin can list members in a selected role.',
      'Role list respects deterministic seeded users.',
    ],
    relatedSpecs: [
      spec(
        'admin-search.spec.js',
        'admin can list members in the shadowban role',
      ),
    ],
  },
  {
    id: 'admin.user-report',
    area: AREA.adminModeration,
    status: STATUS.active,
    description: 'Admins can view an individual user report card.',
    roles: ['admin'],
    references: {
      clientRoutes: [
        clientRoute('admin-user', '/admin/user', source.adminClient, {
          requiresAuth: true,
          requiresRole: 'admin',
        }),
      ],
      apiRoutes: [apiRoute('POST', '/api/admin/user', source.adminServer)],
    },
    requiredScenarios: [
      'Admin user report card loads for a member id.',
      'Report card includes role and message counts.',
      'Missing user id shows a usable error state.',
    ],
    relatedSpecs: [
      spec(
        'admin-inspection.spec.js',
        'admin user report card shows message counts for a shadowbanned member',
      ),
    ],
  },
  {
    id: 'admin.notes',
    area: AREA.adminModeration,
    status: STATUS.active,
    description: 'Admins can read and add notes for moderation workflows.',
    roles: ['admin'],
    references: {
      clientRoutes: [
        clientRoute('admin-user', '/admin/user', source.adminClient, {
          requiresAuth: true,
          requiresRole: 'admin',
        }),
      ],
      apiRoutes: [
        apiRoute('GET', '/api/admin/notes', source.adminServer),
        apiRoute('POST', '/api/admin/notes', source.adminServer),
      ],
    },
    requiredScenarios: [
      'Existing admin notes load for a user.',
      'Admin can add a note and see it persisted.',
    ],
    relatedSpecs: [],
  },
  {
    id: 'admin.change-role',
    area: AREA.adminModeration,
    status: STATUS.active,
    description: 'Admins can change user roles, including shadowban workflows.',
    roles: ['admin'],
    references: {
      clientRoutes: [
        clientRoute('admin-user', '/admin/user', source.adminClient, {
          requiresAuth: true,
          requiresRole: 'admin',
        }),
      ],
      apiRoutes: [
        apiRoute('POST', '/api/admin/user/change-role', source.adminServer),
      ],
    },
    requiredScenarios: [
      'Admin can apply a moderation role change.',
      'Role change is recorded in audit log.',
      'Permission errors are shown for invalid role changes.',
    ],
    relatedSpecs: [],
  },
  {
    id: 'admin.reference-threads',
    area: AREA.adminModeration,
    status: STATUS.active,
    description: 'Admins can inspect reference threads.',
    roles: ['admin'],
    references: {
      clientRoutes: [
        clientRoute(
          'admin-reference-threads',
          '/admin/reference-threads',
          source.adminClient,
          { requiresAuth: true, requiresRole: 'admin' },
        ),
      ],
      apiRoutes: [
        apiRoute('GET', '/api/admin/reference-threads', source.adminServer),
      ],
    },
    requiredScenarios: [
      'Admin reference threads page loads.',
      'Reference thread API returns deterministic rows.',
    ],
    relatedSpecs: [],
  },
  {
    id: 'admin.newsletter-page',
    area: AREA.adminModeration,
    status: STATUS.active,
    description:
      'Admins can open the newsletter admin page when still supported.',
    roles: ['admin'],
    references: {
      clientRoutes: [
        clientRoute(
          'admin-newsletter',
          '/admin/newsletter',
          source.adminClient,
          {
            requiresAuth: true,
            requiresRole: 'admin',
          },
        ),
      ],
      apiRoutes: [],
    },
    requiredScenarios: [
      'Newsletter admin page loads.',
      'Unavailable download actions degrade safely because subscriber APIs are disabled.',
    ],
    relatedSpecs: [spec('admin-pages.spec.js', 'admin newsletter page loads')],
  },
  {
    id: 'admin.newsletter-downloads',
    area: AREA.adminModeration,
    status: STATUS.excluded,
    description: 'Disabled newsletter subscriber download APIs.',
    roles: ['admin'],
    references: {
      clientRoutes: [
        clientRoute(
          'admin-newsletter',
          '/admin/newsletter',
          source.adminClient,
          {
            requiresAuth: true,
            requiresRole: 'admin',
          },
        ),
      ],
      apiRoutes: [
        apiRoute(
          'GET',
          '/api/admin/newsletter-subscribers',
          source.adminServer,
          { disabledInSource: true },
        ),
        apiRoute(
          'GET',
          '/api/admin/newsletter-subscribers/circle',
          source.adminServer,
          { disabledInSource: true },
        ),
      ],
    },
    exclusionReason:
      'Routes are commented out in the server route module and intentionally disabled.',
    requiredScenarios: [],
    relatedSpecs: [],
  },
  {
    id: 'integration.sparkpost-webhook',
    area: AREA.integrationsExcluded,
    status: STATUS.excluded,
    description: 'SparkPost inbound webhook receiver.',
    roles: ['external-service'],
    references: {
      clientRoutes: [],
      apiRoutes: [
        apiRoute('POST', '/api/sparkpost/webhook', source.sparkpostServer),
      ],
    },
    exclusionReason:
      'External email-provider webhook; not a supported user-facing browser feature.',
    requiredScenarios: [],
    relatedSpecs: [],
  },
  {
    id: 'integration.mobile-statistics-telemetry',
    area: AREA.integrationsExcluded,
    status: STATUS.excluded,
    description: 'Mobile/app statistics collection endpoint.',
    roles: ['external-client'],
    references: {
      clientRoutes: [],
      apiRoutes: [apiRoute('POST', '/api/statistics', source.statisticsServer)],
    },
    exclusionReason:
      'Telemetry/mobile-init endpoint; not a normal web UI feature flow.',
    requiredScenarios: [],
    relatedSpecs: [],
  },
  {
    id: 'integration.security-reporting',
    area: AREA.integrationsExcluded,
    status: STATUS.excluded,
    description: 'Browser security report ingestion endpoints.',
    roles: ['browser'],
    references: {
      clientRoutes: [],
      apiRoutes: [
        apiRoute('POST', '/api/report-csp-violation', source.coreServer),
        apiRoute('POST', '/api/report-expect-ct-violation', source.coreServer),
      ],
    },
    exclusionReason:
      'Telemetry/security ingestion endpoints are not user-facing product flows.',
    requiredScenarios: [],
    relatedSpecs: [],
  },
];

module.exports = {
  schemaVersion: 2,
  generatedFrom: {
    clientRouteGlobs: ['modules/*/client/config/*routes*.js'],
    serverRouteGlobs: ['modules/*/server/routes/*.js'],
  },
  coveragePolicy: {
    target:
      '100% of non-excluded user-facing features covered by passing Playwright scenarios.',
    scenarioRequirements:
      'Each requiredScenarios item is a target coverage requirement. A feature should only count as fully covered when every required scenario is covered by a passing e2e test.',
    relatedSpecs:
      'relatedSpecs are existing tests that touch the feature. They are not a coverage signal unless the reporting layer maps them to all required scenarios.',
    diagnosticOnly:
      'Browser/server JavaScript coverage can inform gaps but must not replace this feature matrix.',
    annotationType: 'feature',
    annotationDescription:
      'Use the stable feature id as the Playwright annotation description; add scenario-level annotations before enforcing 100% gates.',
  },
  statuses: STATUS,
  areas: AREA,
  roleDefinitions: ROLE_DEFINITIONS,
  features,
};
