'use strict';

/**
 * Module dependencies.
 */
var _ = require('lodash'),
    config = require('../config'),
    errorHandler = require('../../modules/core/server/controllers/errors.server.controller'),
    facebookNotificationService = require('../../modules/core/server/services/facebook-notification.server.service'),
    languages = require('../languages/languages.json'),
    express = require('express'),
    morgan = require('morgan'),
    bodyParser = require('body-parser'),
    session = require('express-session'),
    MongoStore = require('connect-mongo')(session),
    favicon = require('serve-favicon'),
    compress = require('compression'),
    methodOverride = require('method-override'),
    cookieParser = require('cookie-parser'),
    helmet = require('helmet'),
    flash = require('connect-flash'),
    render = require('./render'),
    git = require('git-rev'),
    path = require('path'),
    paginate = require('express-paginate'),
    uuid = require('uuid');

/**
 * Initialize local variables
 */
module.exports.initLocalVariables = function (app) {
  // Setting application local variables
  app.locals.title = config.app.title;
  app.locals.description = config.app.description;
  app.locals.facebookAppId = config.facebook.clientID;
  app.locals.twitterUsername = config.twitter.username;
  app.locals.facebookPage = config.facebook.page;
  app.locals.googlePage = config.google.page;
  app.locals.googleAnalytics = config.googleAnalytics;
  app.locals.languages = languages;
  app.locals.env = process.env.NODE_ENV;
  app.locals.appSettings = config.app;
  app.locals.appSettings.mapbox = config.mapbox;
  app.locals.appSettings.time = new Date().toISOString();
  app.locals.appSettings.https = config.https;
  app.locals.appSettings.maxUploadSize = config.maxUploadSize;
  app.locals.appSettings.profileMinimumLength = config.profileMinimumLength;
  app.locals.appSettings.invitation = config.invitation;
  app.locals.appSettings.fcmSenderId = config.fcm.senderId;
  app.locals.siteAnnouncement = config.siteAnnouncement || { enabled: false };

  if (process.env.NODE_ENV !== 'production') {
    app.locals.jsFiles = _.concat(config.files.client.js, 'dist/uib-templates.js');
    app.locals.cssFiles = _.map(config.files.client.css, function(file) { return file.replace('/client', ''); });
  }

  // Get 'git rev-parse --short HEAD' (the latest git commit hash) to use as a cache buster
  // @link https://www.npmjs.com/package/git-rev
  git.short(function (str) {
    app.locals.appSettings.commit = str;
  });

  // Passing the request url to environment locals
  app.use(function (req, res, next) {

    // Determine if to use https. When proxying (e.g. with Nginx) to localhost
    // from https front, req.protocol would end up being http when it should be https.
    // @todo: sniff if behind proxy and otherwise rely req.protocol.
    var protocol = (config.https === true || req.protocol === 'https') ? 'https' : 'http';

    res.locals.hostPort = protocol + '://' + req.get('host');
    res.locals.host = protocol + '://' + req.hostname;
    res.locals.url = protocol + '://' + req.headers.host + req.originalUrl;

    next();
  });

  // Dynamically generate nonces to allow inline `<script>` tags to
  // be safely evaluated with using ContentSecurityPolicy headers.
  // See `initHelmetHeaders()` for more.
  app.use(function (req, res, next) {
    res.locals.nonce = uuid.v4();
    next();
  });

};

/**
 * Initialize application middleware
 */
module.exports.initMiddleware = function (app) {

  // Should be placed before express.static
  app.use(compress({
    filter: function (req, res) {
      return (/json|text|javascript|css|font|svg/).test(res.getHeader('Content-Type'));
    },
    level: 9
  }));

  // Initialize pagination middleware
  // Set Pagination default values (limit, max limit)
  app.use(paginate.middleware(20, 50));

  // Initialize favicon middleware
  app.use(favicon('public/favicon.ico'));

  // Environment dependent middleware
  if (process.env.NODE_ENV === 'development') {
    // Enable logger (morgan)
    app.use(morgan('dev'));

    // Disable views cache
    app.set('view cache', false);
  } else if (process.env.NODE_ENV === 'production') {
    app.locals.cache = 'memory';
  }

  // Request body parsing middleware should be above methodOverride
  app.use(bodyParser.urlencoded({
    extended: true
  }));
  app.use(bodyParser.json({
    type: [
      'json',
      // CSP violation reports API endpoint:
      // - Chrome sends application/csp-report
      // - Firefox sends application/json
      // - it seems chrome is doing it well: https://w3c.github.io/webappsec/specs/content-security-policy/
      'application/csp-report'
    ]
  }));
  app.use(methodOverride());

  // Add the cookie parser and flash middleware
  app.use(cookieParser());
  app.use(flash());

};

/**
 * Configure view engine
 */
module.exports.initViewEngine = function (app) {
  // Set swig as the template engine
  app.engine('server.view.html', render);

  // Set views path and view engine
  app.set('view engine', 'server.view.html');
  app.set('views', './');
};

/**
 * Configure Express session
 */
module.exports.initSession = function (app, db) {
  // Express MongoDB session storage
  // https://www.npmjs.com/package/express-session
  app.use(session({
    saveUninitialized: true,
    resave: true,
    secret: config.sessionSecret,
    cookie: {
      // If secure is true, and you access your site over HTTP, the cookie will not be set.
      secure: false, // ...or you could use `config.https`, but it screws things up with Nginx proxy.

      // Specifies the number (in milliseconds) to use when calculating the
      // Expires Set-Cookie attribute. This is done by taking the current
      // server time and adding maxAge milliseconds to the value to calculate
      // an Expires datetime.
      // By default cookie.maxAge is null, meaning no "expires" parameter is
      // set so the cookie becomes a browser-session cookie. When the user
      // closes the browser the cookie (and session) will be removed.
      maxAge: 2419200000 // (in milliseconds) 28 days
    },
    store: new MongoStore({
      mongooseConnection: db.connection,
      collection: config.sessionCollection
    })
  }));
};

/**
 * Invoke modules server configuration
 */
module.exports.initModulesConfiguration = function (app, db) {
  config.files.server.configs.forEach(function (configPath) {
    require(path.resolve(configPath))(app, db);
  });
};

/**
 * Configure Helmet headers configuration
 * https://helmetjs.github.io/docs/
 */
module.exports.initHelmetHeaders = function (app) {
  // Use helmet to secure Express headers
  var SIX_MONTHS = 15778476000;

  /**
   * X-Frame protection ("frameguard") default options.
   * @link https://helmetjs.github.io/docs/frameguard/
   */
  var frameguardOptions = {
    // Action `sameorigin` will prevent anyone from putting this page in an
    // iframe unless it’s on the same origin. That generally means that you can
    // put your own pages in iframes, but nobody else can.
    //
    // action `deny` will prevent anyone from putting this page in an iframe.
    action: 'sameorigin'
  };

  /**
   * Content Security Policy (CSP) "frameAncestors" default value.
   * @link https://helmetjs.github.io/docs/csp/
   */
  var cspFrameAncestors = [
    '\'none\''
  ];

  /**
   * If Facebook notifications are enabled, override default options for:
   * - X-Frame protection
   * - Content Security Policy (CSP) "frameAncestors" value
   *
   * This is required for FB canvas to work,
   * which in turn is required for FB notifications only.
   *
   * X-Frame protection's `allow-from` will allow `https://apps.facebook.com`
   * to put your page in an iframe, but nobody else.
   * Unfortunately, you can only allow one domain and this doesn't work
   * with Chrome as they use CSP FrameAncestors instead.
   *
   * @link https://helmetjs.github.io/docs/frameguard/
   * @link https://canvas.facebook.com
   * @link https://developers.facebook.com/docs/games/gamesonfacebook
   * @link https://developers.facebook.com/docs/games/services/appnotifications
   */
  if (facebookNotificationService.isNotificationsEnabled()) {
    frameguardOptions = {
      action: 'allow-from',
      domain: 'https://apps.facebook.com'
    };
    cspFrameAncestors = [
      'apps.facebook.com'
    ];
  }

  // LiveReload security policy sources are needed only at development
  var cspSrcDevelopment = process.env.NODE_ENV === 'development' ? ['ws://localhost:35729', 'localhost:35729'] : [];

  /*
   * Conten Security Policy (CSP)
   *
   * By default, directives are wide open. If you don't set a specific policy
   * for a directive, let's say `font-src`, then that directive behaves by
   * default as though you'd specified `*` as the valid source
   * (for example, you could load fonts from anywhere, without restriction).
   *
   * @link https://helmetjs.github.io/docs/csp/
   * @link https://developers.google.com/web/fundamentals/security/csp/
   * @link https://content-security-policy.com/
   */
  app.use(helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: [
        '\'self\''
      ],

      // Defines the origins from which scripts can be loaded.
      scriptSrc: [
        // IE Edge does not support `nonce`, thus we need `unsafe-inline`. :-(
        // Using sha instead could work.
        '\'unsafe-inline\'',
        '\'self\'',
        '*.facebook.com',
        '*.facebook.net',
        '*.fbcdn.net', // Facebook releated
        '*.twitter.com',
        '*.google-analytics.com',
        // Use `nonce` for `<script>` tags
        // Nonce is generated above at `initLocalVariables()` middleware
        // @link https://helmetjs.github.io/docs/csp/#generating-nonces
        function (req, res) {
          return '\'nonce-' + res.locals.nonce + '\''; // 'nonce-614d9122-d5b0-4760-aecf-3a5d17cf0ac9'
        }
      ].concat(cspSrcDevelopment),

      // Specifies the origins that can serve web fonts.
      fontSrc: [
        '\'self\'',
        'data:' // Inline fonts (`src: url('data:...')`)
      ],

      // Defines the origins from which stylesheets can be loaded.
      styleSrc: [
        '\'self\'',
        '\'unsafe-inline\''
      ],

      // Defines the origins from which images can be loaded.
      imgSrc: [
        '\'self\'',
        '*.tiles.mapbox.com',
        'api.mapbox.com',
        '*.tile.openstreetmap.org',
        '*.facebook.com',
        '*.fbcdn.net', // Facebook releated
        '*.twitter.com',
        '*.google-analytics.com',
        '*.g.doubleclick.net', // Google Analytics related
        'gravatar.com', // Gravatar (Wordpress)
        '*.wp.com', // Gravatar (Wordpress)
        'ucarecdn.com', // Our Tribe image CDN "Uploadcare.com"
        'data:' // Inline images (`<img src="data:...">`)
      ],

      // Limits the origins that you can connect to
      // (via XHR, WebSockets, and EventSource).
      // If not allowed the browser emulates a 400 HTTP status code.
      connectSrc: [
        '\'self\'',
        'api.mapbox.com',
        'fcm.googleapis.com'
      ].concat(cspSrcDevelopment),

      // Allows control over Flash and other plugins.
      objectSrc: [
        '\'self\''
      ],

      // Allows control of media elements, e.g. HTML5 `<audio>`, `<video>`.
      mediaSrc: [
        '\'self\''
      ],

      // Lists valid endpoints for submission from `<form>` tags.
      formAction: [
        '\'self\'',
        'trustroots.us9.list-manage.com'
      ],

      // specifies the sources that can embed the current page.
      // This directive applies to these tags:
      // `<frame>`, `<iframe>`, `<embed>`, `<applet>`
      frameAncestors: cspFrameAncestors,

      // Defines valid sources for web workers and nested browsing contexts
      // loaded using elements such as `<frame>` and `<iframe>`
      childSrc: [
        '\'self\'',
        '*.twitter.com',
        '*.facebook.com'
      ],

      // San
      // @link https://developers.google.com/web/fundamentals/security/csp/#sandboxing
      // @link https://developers.whatwg.org/origin-0.html#sandboxing
      /*
      sandbox: [
        'allow-forms',
        'allow-scripts'
      ],
      */

      // Defines valid MIME types for plugins invoked via `<object>` and `<embed>`
      /*
      // For some reason Chrome complains about `'none'` as a value here and
      // leaving it empty causes `helmet.contentSecurityPolicy()` crash. :-(
      pluginTypes: [
        '\'none\''
      ],
      */

      // Restricts the URLs that can appear in a page's `<base>` element.
      baseUri: [
        '\'self\''
      ],

      // Browsers report CSP violations to this path using `POST` method
      // See `modules/core/server/routes/core.server.routes.js`
      // Note: If you’re using a CSRF module like csurf, you might have problems
      // handling these violations without a valid CSRF token. The fix is to put
      // your CSP report route above csurf middleware.
      reportUri: '/api/report-csp-violation'
    },

    // Switch the header to `Content-Security-Policy-Report-Only`
    // by settings this `true`.
    //
    // This instructs browsers to report violations to the `reportUri`
    // (if specified) but it will not block any resources from loading.
    //
    // You could also use function here:
    // `function (req, res) { return true; }`
    reportOnly: process.env.NODE_ENV === 'development'
  }));

  // X-Frame protection
  // @link https://helmetjs.github.io/docs/frameguard/
  // @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options
  app.use(helmet.frameguard(frameguardOptions));

  // Adds some small XSS protections
  // @link https://helmetjs.github.io/docs/xss-filter/
  app.use(helmet.xssFilter());

  // Keep clients from sniffing the MIME type
  // @link https://helmetjs.github.io/docs/dont-sniff-mimetype/
  app.use(helmet.noSniff());

  // Sets X-Download-Options for IE8+
  // @link https://helmetjs.github.io/docs/ienoopen/
  app.use(helmet.ieNoOpen());

  // Remove the X-Powered-By header
  // @link https://helmetjs.github.io/docs/hide-powered-by/
  app.use(helmet.hidePoweredBy());
  // Also possible from Express:
  // app.disable('x-powered-by');

  // HTTP Strict Transport Security
  // This only works if your site actually has HTTPS.
  // It won't tell users on HTTP to switch to HTTPS,
  // it will just tell HTTPS users to stick around
  // @link https://helmetjs.github.io/docs/hsts/
  app.use(helmet.hsts({
    maxAge: SIX_MONTHS, // Must be at least 18 weeks to be approved by Google
    includeSubDomains: false, // Must be enabled to be approved by Google
    force: true
  }));
};

/**
 * Configure the modules static routes
 */
module.exports.initModulesClientRoutes = function (app) {
  // Setting the app router and static folder
  app.use('/', express.static(path.resolve('./public')));

  // Globbing static routing
  config.folders.client.forEach(function (staticPath) {
    app.use(staticPath.replace('/client', ''), express.static(path.resolve('./' + staticPath)));
  });

};

/**
 * Configure the modules ACL policies
 */
module.exports.initModulesServerPolicies = function () {
  // Globbing policy files
  config.files.server.policies.forEach(function (policyPath) {
    require(path.resolve(policyPath)).invokeRolesPolicies();
  });
};

/**
 * Configure the modules server routes
 */
module.exports.initModulesServerRoutes = function (app) {
  // Globbing routing files
  config.files.server.routes.forEach(function (routePath) {
    require(path.resolve(routePath))(app);
  });
};

/**
 * Configure error handling
 */
module.exports.initErrorRoutes = function (app) {
  app.use(errorHandler.errorResponse);
};

/**
 * Initialize the Express application
 */
module.exports.init = function (db) {
  // Initialize express app
  var app = express();

  // Initialize local variables
  this.initLocalVariables(app);

  // Initialize Express middleware
  this.initMiddleware(app);

  // Initialize Express view engine
  this.initViewEngine(app);

  // Initialize Helmet security headers
  this.initHelmetHeaders(app);

  // Initialize modules static client routes
  this.initModulesClientRoutes(app);

  // Initialize Express session
  this.initSession(app, db);

  // Initialize Modules configuration
  this.initModulesConfiguration(app);

  // Initialize modules server authorization policies
  this.initModulesServerPolicies(app);

  // Initialize modules server routes
  this.initModulesServerRoutes(app);

  // Initialize error routes
  this.initErrorRoutes(app);

  return app;
};
