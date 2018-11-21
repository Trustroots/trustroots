'use strict';

/**
 * Module dependencies.
 */
var _ = require('lodash'),
    path = require('path'),
    defaultAssets = require('./config/assets/default'),
    testAssets = require('./config/assets/test'),
    gulp = require('gulp'),
    gulpLoadPlugins = require('gulp-load-plugins'),
    MergeStream = require('merge-stream'),
    glob = require('glob'),
    del = require('del'),
    nodemon = require('nodemon'),
    webpack = require('webpack'),
    webpackStream = require('webpack-stream'),
    merge = require('webpack-merge'),
    plugins = gulpLoadPlugins({
      rename: {
        'gulp-angular-templatecache': 'templateCache'
      }
    });

// Local settings
var changedTestFiles = [];

// These will be loaded in `loadConfig` task
var environmentAssets,
    assets,
    config;

/**
 * Load config + assets
 * Note that loading config before `env:*`
 * tasks would load configs with wrong environment
 */
function loadConfig(done) {
  if (!config) {
    config = require('./config/config');
  }
  if (!environmentAssets) {
    environmentAssets = require('./config/assets/' + process.env.NODE_ENV || 'development') || {};
  }
  if (!assets) {
    assets = _.extend(defaultAssets, environmentAssets);
  }
  done();
}

// Nodemon task for server
function runNodemon(done) {
  nodemon({
    script: 'server.js',
    // Default port is `5858`
    // @link https://nodejs.org/api/debugger.html
    nodeArgs: ['--inspect=5858'],
    ext: 'js, html',
    ignore: _.union(
      testAssets.tests.server,
      testAssets.tests.client,
      [
        defaultAssets.server.fontelloConfig,
        defaultAssets.server.gulpConfig,
        'modules/*/client/**',
        'public/**',
        'migrations/**',
        'scripts/**',
        'tmp/**',
        'node_modules/**'
      ]
    ),
    watch: _.union(defaultAssets.server.views, defaultAssets.server.allJS, defaultAssets.server.config)
  })
    .on('crash', function () {
      console.error('[Server] Script crashed.');
    })
    .on('exit', function () {
      console.log('[Server] Script exited.');
    });
  done();
}

// Nodemon task for worker
function runNodemonWorker(done) {
  nodemon({
    script: 'worker.js',
    // Default port is `5858`, but because `nodemon` task is already using it
    // we are defining different port for debugging here.
    // @link https://nodejs.org/api/debugger.html
    nodeArgs: ['--inspect=5859'],
    ext: 'js',
    ignore: _.union(
      testAssets.tests.server,
      testAssets.tests.client,
      [
        defaultAssets.server.fontelloConfig,
        defaultAssets.server.gulpConfig,
        'modules/*/client/**',
        'public/**',
        'migrations/**',
        'scripts/**',
        'tmp/**',
        'node_modules/**'
      ]
    ),
    watch: _.union(
      defaultAssets.server.workerJS,
      defaultAssets.server.allJS,
      defaultAssets.server.config
    )
  })
    .on('crash', function () {
      console.error('[Worker] Script crashed.');
    })
    .on('exit', function () {
      console.log('[Worker] Script exited.');
    });
  done();
}

// Set NODE_ENV to 'test' and prepare environment
gulp.task('env:test', gulp.series(
  function (done) {
    process.env.NODE_ENV = 'test';
    done();
  }
));

// Set NODE_ENV to 'development' and prepare environment
gulp.task('env:dev', gulp.series(
  function (done) {
    process.env.NODE_ENV = 'development';
    done();
  }
));

gulp.task('webpack', gulp.parallel(
  webpackTask({
    entry: './config/webpack/entries/main.js',
    filename: 'main.js',
    path: 'public/assets/'
  }),
  webpackTask({
    entry: './config/webpack/entries/pushMessagingServiceWorker.js',
    filename: 'push-messaging-sw.js',
    path: 'public/'
  })
));

function webpackTask(opts) {
  return function () {
    var resolvedEntry = require.resolve(opts.entry);
    return gulp.src(resolvedEntry)
      .pipe(webpackStream(merge(require('./config/webpack/webpack.config.js'), {
        watch: opts.watch,
        entry: resolvedEntry,
        output: {
          filename: opts.filename
        }
      }), webpack, function (err, stats){
        if (opts.onChange) {
          opts.onChange(err, stats);
        }
      }))
      .pipe(gulp.dest(opts.path));
  };
}

// Set NODE_ENV to 'production' and prepare environment
gulp.task('env:prod', gulp.series(
  function (done) {
    process.env.NODE_ENV = 'production';
    done();
  }
));

// Watch files for changes
gulp.task('watch', function watch(done) {
  // Start Refresh
  plugins.refresh.listen();

  // Watch and lint JS files
  gulp.watch(
    _.union(
      defaultAssets.server.allJS,
      defaultAssets.server.workerJS,
      [
        defaultAssets.server.gulpConfig,
        defaultAssets.server.migrations
      ]
    ),
    gulp.series('lint')
  );

  // Watch and generate app files
  gulp.watch(defaultAssets.server.fontelloConfig, fontello);
  gulp.watch(defaultAssets.server.views).on('change', plugins.refresh.changed);
  gulp.watch(defaultAssets.client.less, gulp.series('clean:css', 'build:styles')).on('change', plugins.refresh.changed);

  if (process.env.NODE_ENV === 'production') {
    gulp.watch(defaultAssets.client.js, gulp.series('lint', 'clean:js', 'build:scripts'));
    gulp.watch(defaultAssets.client.views, gulp.series('clean:js', 'build:scripts')).on('change', plugins.refresh.changed);
  } else {
    gulp.watch(defaultAssets.client.js, gulp.series('lint'));
    gulp.watch(defaultAssets.client.views).on('change', plugins.refresh.changed);
  }
  done();
});

// Watch server test files
gulp.task('watch:server:run-tests', function watchServerRunTests() {
  // Start Refresh
  plugins.refresh.listen();

  // Add Server Test file rules
  gulp.watch([
    testAssets.tests.server,
    defaultAssets.server.allJS,
    defaultAssets.server.migrations
  ],
  gulp.series('test:server:no-lint'))
    .on('change', function (changedFile) {
      changedTestFiles = [];

      // iterate through server test glob patterns
      _.forEach(testAssets.tests.server, function (pattern) {
        // determine if the changed (watched) file is a server test
        _.forEach(glob.sync(pattern), function (file) {
          var filePath = path.resolve(file);

          if (filePath === path.resolve(changedFile)) {
            changedTestFiles.push(changedFile);
          }
        });
      });

      plugins.refresh.changed(changedFile);
    });
});

// ESLint JS linting task
gulp.task('eslint', function eslint() {
  var lintAssets = _.union(
    [
      defaultAssets.server.gulpConfig,
      defaultAssets.server.migrations
    ],
    defaultAssets.server.allJS,
    defaultAssets.client.js,
    testAssets.tests.server,
    testAssets.tests.client,
    // Don't lint dist and lib files
    [
      '!public/**',
      '!node_modules/**'
    ]
  );

  return gulp.src(lintAssets, { allowEmpty: true })
    .pipe(plugins.eslint())
    .pipe(plugins.eslint.format())
    // To have the process exit with an error code (1) on
    // lint error, return the stream and pipe to failAfterError last.
    .pipe(plugins.eslint.failAfterError());
});

// ESLint JS linting task for Angular files
gulp.task('eslint-angular', gulp.series(
  loadConfig,
  function eslintAngular() {
    var lintAssets = _.union(
      assets.client.js,
      // Don't lint dist and lib files
      [
        '!public/**/*',
        '!node_modules/**/*'
      ]
    );

    return gulp.src(lintAssets, { allowEmpty: true })
      .pipe(plugins.eslint({
        configFile: '.eslintrc-angular.js'
      }))
      .pipe(plugins.eslint.format())
      // To have the process exit with an error code (1) on
      // lint error, return the stream and pipe to failAfterError last.
      .pipe(plugins.eslint.failAfterError());
  }
));

// JavaScript task
gulp.task('build:scripts', gulp.series(
  loadConfig,
  angularTemplateCache,
  angularUibTemplatecache,
  'webpack'
));

// Clean JS files -task
gulp.task('clean:js', function cleanJS() {
  return del(['public/dist/*.js']);
});

// Clean CSS files -task
gulp.task('clean:css', function cleanCSS() {
  return del(['public/dist/*.css']);
});

// CSS styles task
gulp.task('build:styles', function buildStyles() {
  if (process.env.NODE_ENV === 'production') {

    var cssStream = gulp.src(defaultAssets.client.lib.css)
      .pipe(plugins.concat('css-files.css'));

    var lessStream = gulp.src(_.union(defaultAssets.client.lib.less, defaultAssets.client.less))
      .pipe(plugins.concat('less-files.less'))
      .pipe(plugins.less());

    // Combine CSS and LESS streams into one minified css file
    // eslint-disable-next-line new-cap
    return MergeStream(lessStream, cssStream)
      .pipe(plugins.concat('application.css'))
      .pipe(plugins.autoprefixer({
        browsers: require('./package.json').browserslist
      }))
      .pipe(plugins.csso())
      .pipe(plugins.rename({ suffix: '.min' }))
      .pipe(gulp.dest('public/dist'));
  } else {
    // In non-production `NODE_ENV`

    // More verbose `less` errors
    var lessProcessor = plugins.less();
    lessProcessor.on('error', function (err) {
      console.log(err);
    });
    // Process only LESS files, since CSS libs will be linked directly at the template
    return gulp.src(_.union(defaultAssets.client.lib.less, defaultAssets.client.less))
      .pipe(plugins.concat('less-files.less'))
      .pipe(lessProcessor)
      .pipe(plugins.autoprefixer({
        browsers: require('./package.json').browserslist
      }))
      .pipe(plugins.rename({ basename: 'application', extname: '.css' }))
      .pipe(gulp.dest('public/dist'))
      .pipe(plugins.refresh());
  }
});

// Angular UI-Boostrap template cache task
// We're not using prebuild UI-Boostraps so that
// we can pick modules we need. Therefore we need
// to manually compile our UIB templates.
function angularUibTemplatecache() {
  var uibModulesStreams = new MergeStream();

  // Loop trough module names
  defaultAssets.client.lib.uibModuleTemplates.forEach(function (uibModule) {

    var moduleStream = gulp.src(['node_modules/angular-ui-bootstrap/template/' + uibModule + '/*.html'])
      .pipe(plugins.htmlmin({ collapseWhitespace: true }))
      .pipe(plugins.templateCache('uib-templates-' + uibModule + '.js', {
        root: 'uib/template/' + uibModule + '/',
        module: 'core',
        templateHeader: '(function() { \'use strict\'; angular.module(\'<%= module %>\'<%= standalone %>).run(templates); templates.$inject = [\'$templateCache\']; function templates($templateCache) {',
        templateBody: '$templateCache.put(\'<%= url %>\', \'<%= contents %>\');',
        templateFooter: '} })();'
      }));

    // Combine with previouly processed templates
    uibModulesStreams.add(moduleStream);
  });

  // Output all tempaltes to one file
  return uibModulesStreams
    .pipe(plugins.concat('uib-templates.js'))
    .pipe(gulp.dest('public/dist'));

}

// Angular template cache task
function angularTemplateCache() {
  return gulp.src(defaultAssets.client.views)
    .pipe(plugins.htmlmin({ collapseWhitespace: true }))
    .pipe(plugins.templateCache('templates.js', {
      root: '/modules/',
      transformUrl: function (url) {
        return url.replace('/client', '');
      },
      module: 'core',
      templateHeader: '(function() { \'use strict\'; angular.module(\'<%= module %>\'<%= standalone %>).run(templates); templates.$inject = [\'$templateCache\']; function templates($templateCache) {',
      templateBody: '$templateCache.put(\'<%= url %>\', \'<%= contents %>\');',
      templateFooter: '} })();'
    }))
    .pipe(gulp.dest('public/dist'));
}

// Generate font icon files from Fontello.com
function fontello() {
  return gulp.src(defaultAssets.server.fontelloConfig)
    .pipe(plugins.fontello({
      font: 'font', // Destination dir for Fonts and Glyphs
      css: 'css', // Destination dir for CSS Styles,
      assetsOnly: true // extract from ZipFile only CSS Styles and Fonts exclude config.json, LICENSE.txt, README.txt and demo.html
    }))
    .pipe(plugins.print())
    .pipe(gulp.dest('modules/core/client/fonts/fontello'))
    .pipe(plugins.refresh());
}

function mocha(done) {
  // Open mongoose connections
  var mongooseService = require('./config/lib/mongoose');
  var agenda = require('./config/lib/agenda');
  var testSuites = changedTestFiles.length ? changedTestFiles : testAssets.tests.server;
  var error;

  // Connect mongoose
  mongooseService.connect(function (db) {
    // Clean out test database to have clean base
    mongooseService.dropDatabase(db, function () {
      mongooseService.loadModels();

      // Run the tests
      gulp.src(testSuites)
        .pipe(plugins.mocha({
          reporter: 'spec',
          timeout: 10000
        }))
        .on('error', function (err) {
          // If an error occurs, save it
          error = err;
          console.error(err);
        })
        .on('end', function () {
          // When the tests are done, disconnect agenda/mongoose
          // and pass the error state back to gulp
          // @TODO: https://github.com/Trustroots/trustroots/issues/438
          // @link https://github.com/agenda/agenda/pull/450
          agenda._mdb.close(function () {
            mongooseService.disconnect(function () {
              done(error);
            });
          });
        });
    });
  });
}

function karma(done) {
  var KarmaServer = require('karma').Server;
  new KarmaServer({
    configFile: __dirname + '/karma.conf.js'
  }, done).start();
}

function karmaWatch(done) {
  var KarmaServer = require('karma').Server;
  new KarmaServer({
    configFile: __dirname + '/karma.conf.js',
    singleRun: false
  }, done).start();
}

// Analyse code for potential errors
gulp.task('lint', gulp.parallel('eslint', 'eslint-angular'));

// Clean dist css and js files
gulp.task('clean', gulp.parallel('clean:css', 'clean:js'));

// Build assets for development mode
gulp.task('build:dev', gulp.series(
  'env:dev',
  gulp.parallel(
    'lint',
    'clean'
  ),
  angularUibTemplatecache,
  gulp.parallel(
    'build:styles',
    'build:scripts'
  )
));

// Build assets for production mode
gulp.task('build:prod', gulp.series(
  'env:prod',
  gulp.parallel(
    'lint',
    'clean'
  ),
  gulp.parallel(
    'build:styles',
    'build:scripts'
  )
));

// Run the project tests
gulp.task('test', gulp.series(
  'env:test',
  karma,
  mocha
));

gulp.task('test:server', gulp.series(
  'env:test',
  gulp.parallel(
    'lint',
    mocha
  )
));

gulp.task('test:server:no-lint', gulp.series(
  'env:test',
  mocha
));

// Watch all server files for changes & run server tests (test:server) task on changes
gulp.task('test:server:watch', gulp.series(
  'test:server:no-lint',
  'watch:server:run-tests'
));

gulp.task('test:client', gulp.series(
  'build:dev',
  'env:test',
  karma
));

gulp.task('test:client:watch', gulp.series(
  'env:test',
  gulp.parallel(
    'lint',
    karmaWatch
  )
));

// Run the project in development mode
gulp.task('develop', gulp.series(
  'env:dev',
  'build:dev',
  gulp.parallel(
    runNodemon,
    'watch',
    webpackTask({
      entry: './config/webpack/entries/main.js',
      filename: 'main.js',
      path: 'public/assets/',
      watch: true,
      onChange: function () {
        console.log('webpack changed!');
        plugins.refresh.changed('/assets/main.js');
      }
    })
  )
));

// Run the project in production mode
gulp.task('prod', gulp.series(
  'env:prod',
  'build:prod',
  gulp.parallel(
    runNodemon,
    'watch'
  )
));

// Run worker script in development mode
gulp.task('worker:dev', gulp.series(
  'env:dev',
  runNodemonWorker
));

// Run worker script in production mode
gulp.task('worker:prod', gulp.series(
  'env:prod',
  runNodemonWorker
));
