import type { Connection } from 'mongoose';
import { readFileSync, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import config from './../config.mts';
import errorService from './../../modules/core/server/services/error.server.service.mts';
import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from 'express';
import log from '@trustroots/logger';
import { createDevelopmentRequestLogger } from './development-request-log.mts';
import session from 'express-session';
import csrfProtection from './csrf-protection.mts';
import validateApiInput from '../../modules/core/server/middleware/api-input.server.middleware.mts';
import { getPublicCharts } from '../../modules/statistics/server/controllers/public-charts.server.controller.mts';
import mongoStore from 'connect-mongo';
import compress from 'compression';
import { securityHeaders } from './security-headers.mts';
import buildMetadata from './build-metadata.mts';
import path from 'path';
import paginate from './../../modules/core/server/services/pagination.server.service.mts';
import { randomUUID } from 'node:crypto';
import qs from 'qs';
interface ExpressSetup {
  initLocalVariables(app: Express): void;
  initMiddleware(app: Express): void;
  initViewEngine(app: Express): void;
  initSession(app: Express, connection: Connection): void;
  initLastSeen(app: Express): Promise<void>;
  initModulesConfiguration(app: Express, db?: Connection): Promise<void>;
  initSecurityHeaders(app: Express): void;
  initModulesClientRoutes(app: Express): void;
  denyAvatarStagingRequests(
    req: Request,
    res: Response,
    next: NextFunction,
  ): unknown;
  initModulesServerRoutes(app: Express): Promise<void>;
  initErrorRoutes(app: Express): void;
  init(connection: Connection): Promise<Express>;
}
const service: ExpressSetup = {
  initLocalVariables,
  initMiddleware,
  initViewEngine,
  initSession,
  initLastSeen,
  initModulesConfiguration,
  initSecurityHeaders,
  initModulesClientRoutes,
  denyAvatarStagingRequests,
  initModulesServerRoutes,
  initErrorRoutes,
  init,
};
/**
 * Module dependencies.
 */

/**
 * Initialize local variables
 */
function initLocalVariables(app: Express) {
  // Setting application local variables
  app.locals.title = config.app.title;
  app.locals.description = config.app.description;
  app.locals.twitterUsername = config.twitter.username;
  app.locals.umami = config.umami;
  app.locals.env =
    ['development', 'test', 'production'].indexOf(
      process.env.NODE_ENV as string,
    ) > -1
      ? process.env.NODE_ENV
      : 'development';
  app.locals.appSettings = config.app;
  app.locals.appSettings.mapbox = config.mapbox;
  app.locals.appSettings.time = new Date().toISOString();
  app.locals.appSettings.https = config.https;
  app.locals.appSettings.maxUploadSize = config.maxAvatarUploadSize;
  app.locals.appSettings.profileMinimumLength = config.profileMinimumLength;
  app.locals.appSettings.referencesEnabled = config.featureFlags.reference;
  app.locals.appSettings.limits = {
    maximumExperienceFeedbackPublicLength:
      config.limits.maximumExperienceFeedbackPublicLength,
    maxOfferValidFromNow: config.limits.maxOfferValidFromNow,
  };
  app.locals.siteAnnouncement = config.siteAnnouncement || {
    enabled: false,
  };

  // Assets for server-rendered error pages. SPA pages use the Start shell.
  if (
    process.env.TRUSTROOTS_VITE_DEV_SERVER === 'true' &&
    process.env.NODE_ENV === 'development'
  ) {
    app.locals.reactJsFiles = [
      'assets/@vite/client',
      'assets/config/vite/load-styles.ts',
    ];
    app.locals.reactCssFiles = [];
  } else {
    app.locals.reactJsFiles = [];
    app.locals.reactCssFiles = ['assets/react-main.css'];
  }

  // Get latest git commit metadata for asset cache busting and support/debug UI.
  buildMetadata.getBuildMetadata(function (metadata) {
    if (!metadata) {
      return;
    }
    app.locals.appSettings.commit = metadata.shortCommit;
    app.locals.appSettings.build = metadata;
  });

  // Passing the request url to environment locals
  app.use(function (req, res, next) {
    // Determine if to use https. When proxying (e.g. with Nginx) to localhost
    // from https front, req.protocol would end up being http when it should be https.
    // @todo: sniff if behind proxy and otherwise rely req.protocol.
    const protocol =
      config.https === true || req.protocol === 'https' ? 'https' : 'http';
    res.locals.hostPort = protocol + '://' + req.get('host');
    res.locals.host = protocol + '://' + req.hostname;
    res.locals.url = protocol + '://' + req.headers.host + req.originalUrl;

    // https://expressjs.com/en/api.html#req.path
    res.locals.canonicalUrl = res.locals.hostPort + req.path;

    // Native mobile app wrapper loads the site with `?app` URL query argument.
    res.locals.isNativeMobileApp = Object.hasOwn(req.query, 'app');
    next();
  });
}

/**
 * Initialize application middleware
 */
function initMiddleware(app: Express) {
  // Should be placed before express.static
  app.use(
    compress({
      filter(req, res) {
        return /json|text|javascript|css|font|svg/.test(
          res.getHeader('Content-Type') as string,
        );
      },
      level: 9,
    }),
  );

  // Initialize pagination middleware
  // Set Pagination default values (limit, max limit)
  app.use(paginate.middleware(config.limits.paginationLimit, 50));

  const faviconPath = new URL('../../public/favicon.ico', import.meta.url);
  const favicon = readFileSync(faviconPath);
  const faviconLastModified = statSync(faviconPath).mtime.toUTCString();
  app.get('/favicon.ico', (_req, res) => {
    res
      .type('ico')
      .set('Cache-Control', 'public, max-age=31536000')
      .set('Last-Modified', faviconLastModified)
      .send(favicon);
  });

  // Environment dependent middleware
  if (process.env.NODE_ENV === 'development') {
    app.use(createDevelopmentRequestLogger(log));

    // Disable views cache
    app.set('view cache', false);
  } else if (process.env.NODE_ENV === 'production') {
    app.locals.cache = 'memory';
  }

  // Parse supported request bodies before route handlers.
  app.use(
    express.urlencoded({
      extended: true,
    }),
  );
  // Only reduced import manifests receive this larger bounded JSON allowance.
  app.use('/api/admin/support-import/preview', express.json({ limit: '10mb' }));
  app.use(
    express.json({
      type: [
        'json',
        // CSP violation reports API endpoint:
        // - Chrome sends application/csp-report
        // - Firefox sends application/json
        // - it seems chrome is doing it well: https://w3c.github.io/webappsec/specs/content-security-policy/
        'application/csp-report',
      ],
    }),
  );
}

/**
 * Configure view engine
 */
function initViewEngine(app: Express) {
  // Each view is a module whose default export renders the page to HTML.
  app.engine('mts', (file, locals, callback) => {
    import(pathToFileURL(file).href)
      .then(view => view.default(locals))
      .then(html => callback(null, html), callback);
  });
  app.set('view engine', 'mts');
  app.set('views', './modules/core/server/views');
}

/**
 * Configure Express session
 */
function initSession(app: Express, connection: Connection) {
  const sessionStoreOptions = {
    client: connection.getClient(),
    collection: config.sessionCollection,
  };
  // Express MongoDB session storage
  // https://www.npmjs.com/package/express-session
  const browserSession = session({
    saveUninitialized: false,
    resave: false,
    secret: config.sessionSecret,
    // Trust forwarded protocol only when explicitly enabled for a trusted
    // HTTPS frontend. Direct TLS (for example Passenger) needs no proxy.
    proxy: config.sessionProxy === true,
    cookie: {
      secure: config.https === true,
      httpOnly: true,
      sameSite: 'lax',
      // Specifies the number (in milliseconds) to use when calculating the
      // Expires Set-Cookie attribute. This is done by taking the current
      // server time and adding maxAge milliseconds to the value to calculate
      // an Expires datetime.
      // By default cookie.maxAge is null, meaning no "expires" parameter is
      // set so the cookie becomes a browser-session cookie. When the user
      // closes the browser the cookie (and session) will be removed.
      maxAge: 2419200000, // (in milliseconds) 28 days
    },
    store: mongoStore.create(sessionStoreOptions),
  });

  app.use(function browserSessionOnly(req, res, next) {
    if (/^\/api\/mobile\/v0(?:\/|$)/.test(req.path)) {
      return next();
    }
    return browserSession(req, res, next);
  });
}

/**
 * Wire in user last seen middleware
 */
async function initLastSeen(app: Express) {
  const { default: lastSeenController } =
    await import('../../modules/users/server/controllers/users.lastseen.server.controller.mts');
  app.use(lastSeenController);
}

/**
 * Invoke modules server configuration
 */
async function initModulesConfiguration(app: Express, db?: Connection) {
  for (const configPath of config.files.server.configs) {
    const { default: configure } = await import(
      pathToFileURL(path.resolve(configPath)).href
    );
    await configure(app, db);
  }
}

/**
 * Set the security headers and the per-request CSP nonce
 */
function initSecurityHeaders(app: Express) {
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.locals.nonce = randomUUID();
    res.set(securityHeaders(res.locals.nonce));
    next();
  });
}

/**
 * Configure the modules static routes
 */
function initModulesClientRoutes(app: Express) {
  // Setting the app router and static folder
  app.use(denyAvatarStagingRequests);
  app.use('/', express.static(path.resolve('./public')));
  app.use('/', express.static(path.resolve('./public/assets')));
}
function denyAvatarStagingRequests(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(req.path);
  } catch {
    return res.sendStatus(404);
  }
  if (decodedPath.split('/').some(segment => segment.startsWith('.staging-'))) {
    return res.sendStatus(404);
  }
  return next();
}

/**
 * Configure the modules server routes
 */
async function initModulesServerRoutes(app: Express) {
  // Globbing routing files
  for (const routePath of config.files.server.routes) {
    const { default: routes } = await import(
      pathToFileURL(path.resolve(routePath)).href
    );
    routes(app);
  }
}

/**
 * Configure error handling
 */
function initErrorRoutes(app: Express) {
  app.use(errorService.errorResponse);
}

/**
 * Initialize the Express application
 */
async function init(
  this: ExpressSetup,
  connection: Connection,
): Promise<Express> {
  // Initialize express app
  const app = express();
  app.set('query parser', (query: string) => qs.parse(query));

  // Express 5 returns a fresh query object on every access. Keep one mutable
  // object per request for middleware and local variables that normalise or
  // read query values.
  app.use((req, res, next) => {
    Object.defineProperty(req, 'query', {
      configurable: true,
      enumerable: true,
      value: req.query,
    });
    next();
  });

  // Initialize local variables
  this.initLocalVariables(app);

  // Initialize Express middleware
  this.initMiddleware(app);

  // Reject cross-origin state changes after method override and body parsing,
  // but before session and route middleware.
  app.use(csrfProtection(config as Parameters<typeof csrfProtection>[0]));
  app.use('/api', validateApiInput);

  // Initialize Express view engine
  this.initViewEngine(app);

  // Initialize security headers
  this.initSecurityHeaders(app);

  // The aggregate chart response is public and independent of browser sessions.
  app.get('/api/statistics/charts', getPublicCharts);

  // Initialize modules static client routes
  this.initModulesClientRoutes(app);

  // Initialize Express session
  this.initSession(app, connection);

  // Initialize Modules configuration
  await this.initModulesConfiguration(app);

  // Initialize last seen middleware
  await this.initLastSeen(app);

  // Initialize modules server routes
  await this.initModulesServerRoutes(app);

  // Initialize error routes
  this.initErrorRoutes(app);
  return app;
}
export default service;
