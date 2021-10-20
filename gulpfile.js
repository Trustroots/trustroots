/* eslint-disable no-console */

/**
 * Module dependencies.
 */
const _ = require('lodash');
const defaultAssets = require('./config/assets/default');
const gulp = require('gulp');
const gulpLoadPlugins = require('gulp-load-plugins');
const minimatch = require('minimatch');
const del = require('del');
const nodemon = require('nodemon');
const print = require('gulp-print').default;
const plugins = gulpLoadPlugins();

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
  defaultAssets.server.gulpConfig,
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
    watch: _.union(
      defaultAssets.server.views,
      defaultAssets.server.allJS,
      defaultAssets.server.config,
    ),
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
      defaultAssets.server.config,
    ),
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
gulp.task(
  'env:dev',
  gulp.series(function (done) {
    process.env.NODE_ENV = 'development';
    done();
  }),
);

// Set NODE_ENV to 'production' and prepare environment
gulp.task(
  'env:prod',
  gulp.series(function (done) {
    process.env.NODE_ENV = 'production';
    done();
  }),
);

// Watch server test files
gulp.task('watch:server:run-tests', function watchServerRunTests() {
  // Add Server Test file rules
  gulp
    .watch(
      [
        'modules/*/tests/server/**/*.js',
        ...defaultAssets.server.allJS,
        defaultAssets.server.migrations,
      ],
      gulp.series('test:server'),
    )
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

// Generate font icon files from Fontello.com
function fontello() {
  return gulp
    .src(defaultAssets.server.fontelloConfig)
    .pipe(
      plugins.fontello({
        font: 'font', // Destination dir for Fonts and Glyphs
        css: 'css', // Destination dir for CSS Styles,
        assetsOnly: false,
      }),
    )
    .pipe(print())
    .pipe(gulp.dest('modules/core/client/fonts/fontello'));
}

function mocha(done) {
  // Open mongoose connections
  const mongooseService = require('./config/lib/mongoose');
  const agenda = require('./config/lib/agenda');
  const testSuites =
    changedTestFiles.length > 0
      ? changedTestFiles
      : 'modules/*/tests/server/**/*.js';
  let error;

  // Connect mongoose
  mongooseService.connect(db => {
    // Clean out test database to have clean base
    mongooseService.dropDatabase(db, () => {
      mongooseService.loadModels();

      // Run the tests
      gulp
        .src(testSuites)
        .pipe(
          plugins.mocha({
            reporter: 'spec',
            timeout: 10000,
          }),
        )
        .on('error', err => {
          // If an error occurs, save it
          error = err;
          console.error(err);
        })
        .on('end', async () => {
          // When the tests are done, disconnect agenda/mongoose
          // and pass the error state back to Gulp
          await agenda.close();
          mongooseService.disconnect(() => {
            done(error);
          });
        });
    });
  });
}

// Run fontello update
gulp.task('fontello', fontello);

gulp.task('test:server', gulp.series(mocha));

// Watch all server files for changes & run server tests (test:server) task on changes
gulp.task(
  'test:server:watch',
  gulp.series('test:server', 'watch:server:run-tests'),
);

// Run the project in development mode
gulp.task('develop', gulp.series('env:dev', runNodemon));

// Run the project in production mode
gulp.task('prod', gulp.series('env:prod', runNodemon));

// Run worker script in development mode
gulp.task('worker:dev', gulp.series('env:dev', runNodemonWorker));

// Run worker script in production mode
gulp.task('worker:prod', gulp.series('env:prod', runNodemonWorker));
