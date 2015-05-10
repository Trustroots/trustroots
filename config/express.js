'use strict';

/**
 * Module dependencies.
 */
var express = require('express'),
    http = require('http'),
    //socketio = require('socket.io'),
    morgan = require('morgan'),
    bodyParser = require('body-parser'),
    session = require('express-session'),
    compress = require('compression'),
    methodOverride = require('method-override'),
    cookieParser = require('cookie-parser'),
    helmet = require('helmet'),
    passport = require('passport'),
    mongoStore = require('connect-mongo')({
      session: session
    }),
    flash = require('connect-flash'),
    config = require('./config'),
    consolidate = require('consolidate'),
    path = require('path'),
    git = require('git-rev'),
    paginate = require('express-paginate');

module.exports = function(db) {
  // Initialize express app
  var app = express();

  // Globbing model files
  config.getGlobbedFiles('./app/models/**/*.js').forEach(function(modelPath) {
    require(path.resolve(modelPath));
  });

  // Setting application local variables
  app.locals.title = config.app.title;
  app.locals.description = config.app.description;
  app.locals.facebookAppId = config.facebook.clientID;
  app.locals.twitterUsername = config.twitter.username;
  app.locals.newrelic = config.newrelic.enabled;
  app.locals.GAcode = config.GA.code;
  app.locals.jsFiles = config.getJavaScriptAssets();
  app.locals.cssFiles = config.getCSSAssets();
  app.locals.languages = require('../public/modules/core/languages/languages.json');
  app.locals.appSettings = config.app.settings;
  app.locals.appSettings.tagline = config.app.tagline;
  app.locals.appSettings.time = new Date().toISOString();
  app.locals.appSettings.https = config.https;

  // Get 'git rev-parse --short HEAD' (the latest git commit hash) to use as a cache buster
  // @link https://www.npmjs.com/package/git-rev
  git.short(function (str) {
    app.locals.appSettings.commit = str;
  });

  // Passing the request url to environment locals
  app.use(function(req, res, next) {
    res.locals.url = '//' + req.headers.host + '/';
    next();
  });

  // Should be placed before express.static
  app.use(compress({
    filter: function(req, res) {
      return (/json|text|javascript|css/).test(res.getHeader('Content-Type'));
    },
    level: 9
  }));

  // Showing stack errors
  app.set('showStackError', true);

  // Set swig as the template engine
  app.engine('server.view.html', consolidate[config.templateEngine]);

  // Set views path and view engine
  app.set('view engine', 'server.view.html');
  app.set('views', './app/views');

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

  // Trust proxy (e.g. Nginx/Phusion Passenger)
  // If you have your node.js behind a proxy and are using secure:
  // true with session cookies, you need to set "trust proxy".
  if(config.https) {
    app.set('trust proxy', 1); // trust first proxy
  }

  // CookieParser should be above session
  app.use(cookieParser());

  // Express MongoDB session storage
  // https://www.npmjs.com/package/express-session
  app.use(session({
    saveUninitialized: true,
    resave: true,
    secret: config.sessionSecret,
    cookie: {
      // If secure is true, and you access your site over HTTP, the cookie will not be set.
      secure: config.https,

      // By default cookie.maxAge is null, meaning no "expires" parameter is
      // set so the cookie becomes a browser-session cookie. When the user
      // closes the browser the cookie (and session) will be removed.
      maxAge: 2419200000
    },
    store: new mongoStore({
      mongooseConnection: db.connection,
      collection: config.sessionCollection
    })
  }));

  // use passport session
  app.use(passport.initialize());
  app.use(passport.session());

  // connect flash for flash messages
  app.use(flash());

  // Use helmet to secure Express headers
  app.use(helmet.xframe());
  app.use(helmet.xssFilter());
  app.use(helmet.nosniff());
  app.use(helmet.ienoopen());
  app.disable('x-powered-by');

  // Set Pagination default values (limit, max limit)
  app.use(paginate.middleware(20, 50));

  // Setting the app router and static folder
  app.use(express.static(path.resolve('./public')));

  // Globbing routing files
  config.getGlobbedFiles('./app/routes/**/*.js').forEach(function(routePath) {
    require(path.resolve(routePath))(app);
  });

  // Assume 'not found' in the error msgs is a 404. this is somewhat silly, but valid, you can do whatever you like, set properties, use instanceof etc.
  app.use(function(err, req, res, next) {
    // If the error object doesn't exists
    if (!err) return next();

    // Log it
    console.error(err.stack);

    // Error page
    res.status(500).render('500', {
      error: err.stack
    });
  });

  // Assume 404 since no middleware responded
  app.use(function(req, res) {
    res.status(404).render('404', {
      url: req.originalUrl,
      error: 'Not Found'
    });
  });

  // Attach Socket.io
  // @link: http://vexxhost.com/blog/mean-socket-io-integration-tutorial/
  var server = http.createServer(app);
  //var io = socketio.listen(server);
  //app.set('socketio', io);
  app.set('server', server);

  return app;
};
