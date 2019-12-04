/* eslint-disable no-console */

/**
 * Module dependencies.
 */
const _ = require('lodash');
const path = require('path');
const defaultAssets = require('./config/assets/default');
const gulp = require('gulp');
const gulpLoadPlugins = require('gulp-load-plugins');
const MergeStream = require('merge-stream');
const glob = require('glob');
const del = require('del');
const nodemon = require('nodemon');
const webpack = require('webpack');
const webpackStream = require('webpack-stream');
const merge = require('webpack-merge');
const print = require('gulp-print').default;
const plugins = gulpLoadPlugins({
  rename: {
    'gulp-angular-templatecache': 'templateCache'
  }
});

// Local settings
let changedTestFiles = [];

// These will be loaded in `loadConfig` task
let environmentAssets;
let assets;
let config;

// Globbed paths ignored by Nodemon
const nodemonIgnores = [
  'bin/**',
  'migrations/**',
  'modules/*/client/**',
  'modules/*/tests/client/**/*.js',
  'modules/*/tests/server/**/*.js',
  'node_modules/**',
  'public/**',
  'scripts/**',
  'tmp/**',
  defaultAssets.server.fontelloConfig,
  defaultAssets.server.gulpConfig
];

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
    ignore: nodemonIgnores,
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
    ignore: nodemonIgnores,
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
    const resolvedEntry = require.resolve(opts.entry);
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

  // Watch and generate app files
  gulp.watch(defaultAssets.server.views).on('change', plugins.refresh.changed);
  gulp.watch(defaultAssets.client.less, gulp.series('clean:css', 'build:styles')).on('change', plugins.refresh.changed);

  if (process.env.NODE_ENV === 'production') {
    gulp.watch(defaultAssets.client.js, gulp.series('clean:js', 'build:scripts'));
    gulp.watch(defaultAssets.client.views, gulp.series('clean:js', 'build:scripts')).on('change', plugins.refresh.changed);
  } else {
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
    'modules/*/tests/server/**/*.js',
    defaultAssets.server.allJS,
    defaultAssets.server.migrations
  ],
  gulp.series('test:server'))
    .on('change', function (changedFile) {
      changedTestFiles = [];

      // iterate through server test glob patterns
      _.forEach('modules/*/tests/server/**/*.js', function (pattern) {
        // determine if the changed (watched) file is a server test
        _.forEach(glob.sync(pattern), function (file) {
          const filePath = path.resolve(file);

          if (filePath === path.resolve(changedFile)) {
            changedTestFiles.push(changedFile);
          }
        });
      });

      plugins.refresh.changed(changedFile);
    });
});

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

    const cssStream = gulp.src(defaultAssets.client.lib.css)
      .pipe(plugins.concat('css-files.css'));

    const lessStream = gulp.src(_.union(defaultAssets.client.lib.less, defaultAssets.client.less))
      .pipe(plugins.concat('less-files.less'))
      .pipe(plugins.less());

    // Combine CSS and LESS streams into one minified css file
    // eslint-disable-next-line new-cap
    return MergeStream(lessStream, cssStream)
      .pipe(plugins.concat('application.css'))
      .pipe(plugins.autoprefixer())
      .pipe(plugins.csso())
      .pipe(plugins.rename({ suffix: '.min' }))
      .pipe(gulp.dest('public/dist'));
  } else {
    // In non-production `NODE_ENV`

    // More verbose `less` errors
    const lessProcessor = plugins.less();
    lessProcessor.on('error', function (err) {
      console.error(err);
    });
    // Process only LESS files, since CSS libs will be linked directly at the template
    return gulp.src(_.union(defaultAssets.client.lib.less, defaultAssets.client.less))
      .pipe(plugins.concat('less-files.less'))
      .pipe(lessProcessor)
      .pipe(plugins.autoprefixer())
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
  const uibModulesStreams = new MergeStream();

  // Loop trough module names
  defaultAssets.client.lib.uibModuleTemplates.forEach(function (uibModule) {

    const moduleStream = gulp.src(['node_modules/angular-ui-bootstrap/template/' + uibModule + '/*.html'])
      .pipe(plugins.htmlmin({ collapseWhitespace: true }))
      .pipe(plugins.templateCache('uib-templates-' + uibModule + '.js', {
        root: 'uib/template/' + uibModule + '/',
        module: 'core',
        templateHeader: '(function() { angular.module(\'<%= module %>\'<%= standalone %>).run(templates); templates.$inject = [\'$templateCache\']; function templates($templateCache) {',
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
      templateHeader: '(function() { angular.module(\'<%= module %>\'<%= standalone %>).run(templates); templates.$inject = [\'$templateCache\']; function templates($templateCache) {',
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
      assetsOnly: false
    }))
    .pipe(print())
    .pipe(gulp.dest('modules/core/client/fonts/fontello'))
    .pipe(plugins.refresh());
}

function mocha(done) {
  // Open mongoose connections
  const mongooseService = require('./config/lib/mongoose');
  const agenda = require('./config/lib/agenda');
  const testSuites = changedTestFiles.length ? changedTestFiles : 'modules/*/tests/server/**/*.js';
  let error;

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

gulp.task('angular-templatecache', gulp.series(angularTemplateCache, angularUibTemplatecache));

// Clean dist css and js files
gulp.task('clean', gulp.parallel('clean:css', 'clean:js'));

// Build assets for development mode
gulp.task('build:dev', gulp.series(
  'env:dev',
  'clean',
  angularUibTemplatecache,
  gulp.parallel(
    'build:styles',
    'build:scripts'
  )
));

// Build assets for production mode
gulp.task('build:prod', gulp.series(
  'env:prod',
  'clean',
  gulp.parallel(
    'build:styles',
    'build:scripts'
  )
));

// Run fontello update
gulp.task('fontello', fontello);

gulp.task('test:server', gulp.series(
  mocha
));


// Watch all server files for changes & run server tests (test:server) task on changes
gulp.task('test:server:watch', gulp.series(
  'test:server',
  'watch:server:run-tests'
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
        console.log('Webpack detected a change');
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
