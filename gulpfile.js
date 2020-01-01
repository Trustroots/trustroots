/* eslint-disable no-console */

/**
 * Module dependencies.
 */
const _ = require('lodash');
const defaultAssets = require('./config/assets/default');
const gulp = require('gulp');
const gulpLoadPlugins = require('gulp-load-plugins');
const MergeStream = require('merge-stream');
const minimatch = require('minimatch');
const del = require('del');
const nodemon = require('nodemon');
const print = require('gulp-print').default;
const plugins = gulpLoadPlugins({
  rename: {
    'gulp-angular-templatecache': 'templateCache'
  }
});

// Local settings
let changedTestFiles = [];

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

// Set NODE_ENV to 'production' and prepare environment
gulp.task('env:prod', gulp.series(
  function (done) {
    process.env.NODE_ENV = 'production';
    done();
  }
));

// Watch files for changes
gulp.task('watch', function watch(done) {
  if (process.env.NODE_ENV === 'production') {
    gulp.watch(defaultAssets.client.js, gulp.series('clean', 'angular-templatecache'));
    gulp.watch(defaultAssets.client.views, gulp.series('clean', 'angular-templatecache'));
  }
  done();
});

// Watch server test files
gulp.task('watch:server:run-tests', function watchServerRunTests() {
  // Add Server Test file rules
  gulp.watch([
    'modules/*/tests/server/**/*.js',
    ...defaultAssets.server.allJS,
    defaultAssets.server.migrations
  ],
  gulp.series('test:server'))
    .on('change', function (changedFile) {
      changedTestFiles = [];
      // determine if the changed (watched) file is a server test
      if (minimatch(changedFile, 'modules/*/tests/server/**/*.js')) {
        changedTestFiles.push(changedFile);
      }
    });
});

// Clean JS files -task
gulp.task('clean', function clean() {
  return del(['public/dist/*.js']);
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
    .pipe(gulp.dest('modules/core/client/fonts/fontello'));
}

function mocha(done) {
  // Open mongoose connections
  const mongooseService = require('./config/lib/mongoose');
  const agenda = require('./config/lib/agenda');
  const testSuites = changedTestFiles.length > 0 ? changedTestFiles : 'modules/*/tests/server/**/*.js';
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

// Build assets for production mode
gulp.task('build:prod', gulp.series(
  'env:prod',
  'clean',
  'angular-templatecache'
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
  gulp.parallel(
    runNodemon,
    'watch'
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
