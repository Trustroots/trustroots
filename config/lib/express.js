'use strict';

/**
 * Module dependencies.
 */
var _ = require('lodash'),
    config = require('../config'),
    errorHandler = require('../../modules/core/server/controllers/errors.server.controller'),
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
    consolidate = require('consolidate'),
    git = require('git-rev'),
    path = require('path'),
    paginate = require('express-paginate'),
    seo = require('mean-seo'),
    path = require('path'),
    Agenda = require('agenda');

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
  app.locals.appSettings = config.app;
  app.locals.appSettings.mapbox = config.mapbox;
  app.locals.appSettings.time = new Date().toISOString();
  app.locals.appSettings.https = config.https;
  app.locals.appSettings.maxUploadSize = config.maxUploadSize;

  app.locals.jsFiles = config.files.client.js;
  app.locals.cssFiles = _.map(config.files.client.css, function(file) { return file.replace('/client', ''); });

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
};

/**
 * Initialize application middleware
 */
module.exports.initMiddleware = function (app) {
  // Showing stack errors
  app.set('showStackError', true);

  // Enable jsonp
  app.enable('jsonp callback');

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
  app.use(bodyParser.json());
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
  app.engine('server.view.html', consolidate.swig);

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
      secure: false,//config.https,

      // By default cookie.maxAge is null, meaning no "expires" parameter is
      // set so the cookie becomes a browser-session cookie. When the user
      // closes the browser the cookie (and session) will be removed.
      maxAge: 2419200000
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
 */
module.exports.initHelmetHeaders = function (app) {
  // Use helmet to secure Express headers
  app.use(helmet.xframe());
  app.use(helmet.xssFilter());
  app.use(helmet.nosniff());
  app.use(helmet.ienoopen());
  app.disable('x-powered-by');
};

/**
 * Configure SEO rendering for `/?_escaped_fragment_=/pagename` -urls
 * This must come before client route configs
 * @link http://meanjs.org/modules.html#seo
 */
module.exports.initSEO = function (app) {
  app.use(seo({
    cacheClient: 'disk', // Can be 'disk' or 'redis'
    cacheDuration: 2 * 60 * 60 * 24 * 1000, // In milliseconds for disk cache
  }));
};

/**
 * Configure Agenda "Cron" jobs
 * @link https://www.npmjs.com/package/agenda
 */
module.exports.initAgenda = function (app, db) {

  // Don't launch Agenda on test environment
  // @todo: make it possible to launch this manually with very small interwalls for testing
  // @todo: similarly for testing purposes, write a stopAgenda() method
  if(process.env.NODE_ENV !== 'production') {
    return;
  }

  // Setup agenda
  var agendaWorker = new Agenda({
    db: {
      address: config.db.uri,
      collection: 'agendaJobs'
    }
  });

  agendaWorker.on('ready', function() {
    // Load jobs
    var messagesUnreadJob = require(path.resolve('./modules/messages/server/jobs/message-unread.server.job'));

    // Schedule job(s)
    messagesUnreadJob.checkUnreadMessages(agendaWorker);
    agendaWorker.every('5 minutes', 'check unread messages');

    // Start worker
    agendaWorker.start();
    console.log('Agenda started processing background jobs');
  });

  // Error reporting
  agendaWorker.on('fail', function(err, job) {
    console.error('Agenda job failed with error: %s', err.message);
  });
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
module.exports.initModulesServerPolicies = function (app) {
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
 * Configure Socket.io
 */
/*
module.exports.configureSocketIO = function (app, db) {
  // Load the Socket.io configuration
  var server = require('./socket.io')(app, db);

  // Return server object
  return server;
};
*/

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

  // Initialize SEO Modules
  this.initSEO(app);

  // Initialize modules server routes
  this.initModulesServerRoutes(app);

  // Initialize error routes
  this.initErrorRoutes(app);

  // Initialize Agenda ("cron" jobs)
  this.initAgenda(app, db);

  // Configure Socket.io
  //app = this.configureSocketIO(app, db);

  return app;
};
