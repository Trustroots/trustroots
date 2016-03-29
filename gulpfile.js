'use strict';

/**
 * Module dependencies.
 */
var _ = require('lodash'),
  defaultAssets = require('./config/assets/default'),
  testAssets = require('./config/assets/test'),
  gulp = require('gulp'),
  gulpLoadPlugins = require('gulp-load-plugins'),
  runSequence = require('run-sequence'),
  MergeStream = require('merge-stream'),
  glob = require('glob'),
  path = require('path'),
  del = require('del'),
  fs = require('fs'),
  argv = require('yargs').argv,
  plugins = gulpLoadPlugins({
    rename: {
      'gulp-angular-templatecache': 'templateCache'
    }
  }),
  KarmaServer = require('karma').Server;

gulp.task('bower', function() {
  return plugins.bower();
});

// Set NODE_ENV to 'test'
gulp.task('env:test', function() {
  process.env.NODE_ENV = 'test';
});

// Set NODE_ENV to 'development'
gulp.task('env:dev', function() {
  process.env.NODE_ENV = 'development';
});

// Set NODE_ENV to 'production'
gulp.task('env:prod', function() {
  process.env.NODE_ENV = 'production';
});

// Make sure local config file exists
gulp.task('copyConfig', function(done) {
  if(!fs.existsSync('config/env/local.js') ) {
    return gulp
      .src('config/env/local.sample.js')
      .pipe(plugins.rename('local.js'))
      .pipe(gulp.dest('config/env/'));
  }
  else {
    done();
  }
});

// Nodemon task
gulp.task('nodemon', function() {
  return plugins.nodemon({
    script: 'server.js',
    nodeArgs: ['--debug'],
    ext: 'js html',
    ignore: _.union(
      testAssets.tests.server,
      testAssets.tests.client,
      testAssets.tests.e2e,
      ['modules/*/client/**', 'public/**', 'migrations/**', 'scripts/**', 'tmp/**', 'node_modules/**'],
      [defaultAssets.server.fontelloConfig, defaultAssets.server.gulpConfig]
    ),
    watch: _.union(defaultAssets.server.views, defaultAssets.server.allJS, defaultAssets.server.config)
  });
});

// Watch files for changes
gulp.task('watch', function() {
  // Start livereload
  plugins.livereload.listen();

  // Add watch rules
  gulp.watch(defaultAssets.server.views).on('change', plugins.livereload.changed);
  gulp.watch(defaultAssets.server.allJS, ['jshint']).on('change', plugins.livereload.changed);
  gulp.watch(defaultAssets.server.fontelloConfig, ['fontello']);
  gulp.watch(defaultAssets.client.less, ['clean:css', 'styles']);

  if (process.env.NODE_ENV === 'production') {
    gulp.watch(defaultAssets.client.js, ['jshint', 'clean:js', 'uibTemplatecache', 'scripts']);
    gulp.watch(defaultAssets.server.gulpConfig, ['jshint']);
    gulp.watch(defaultAssets.client.views, ['clean:js', 'templatecache', 'uibTemplatecache', 'jshint', 'scripts']).on('change', plugins.livereload.changed);
  } else {
    gulp.watch(defaultAssets.client.js, ['jshint']).on('change', plugins.livereload.changed);
    gulp.watch(defaultAssets.server.gulpConfig, ['jshint']);
    gulp.watch(defaultAssets.client.views).on('change', plugins.livereload.changed);
  }

  if (process.env.NODE_ENV === 'test') {
    // Add Server Test file rules
    gulp.watch([testAssets.tests.server, defaultAssets.server.allJS], ['test:server']).on('change', function(file) {

      var runOnlyChangedTestFile = argv.onlyChanged ? true : false;

      // check if we should only run a changed test file
      if (runOnlyChangedTestFile) {
        var changedTestFiles = [];

        // iterate through server test glob patterns
        _.forEach(testAssets.tests.server, function(pattern) {
          // determine if the changed (watched) file is a server test
          _.forEach(glob.sync(pattern), function(f) {
            var filePath = path.resolve(f);

            if (filePath === path.resolve(file.path)) {
              changedTestFiles.push(f);
            }
          });
        });

        // set task argument for tracking changed test files
        argv.changedTestFiles = changedTestFiles;
      }

      plugins.livereload.changed();
    });
  }

});

// JS linting task
gulp.task('jshint', function() {
  var assets = _.union(
    defaultAssets.server.gulpConfig,
    defaultAssets.server.allJS,
    defaultAssets.client.js,
    testAssets.tests.server,
    testAssets.tests.client,
    testAssets.tests.e2e
  );

  return gulp.src(assets)
    .pipe(plugins.jshint())
    .pipe(plugins.jshint.reporter('default'))
    .pipe(plugins.jshint.reporter('fail'));
});

// JavaScript task
gulp.task('scripts', function() {
  return gulp.src( _.union(defaultAssets.client.lib.js, defaultAssets.client.js, ['public/dist/uib-templates.js', 'public/dist/templates.js']) )
    .pipe(plugins.ngAnnotate())
    .pipe(plugins.uglify({
      mangle: false
    }))
    .pipe(plugins.concat('application.min.js'))
    .pipe(gulp.dest('public/dist'));
});

// Clean JS files -task
gulp.task('clean:js', function() {
  return del(['public/dist/*.js']);
});

// Clean CSS files -task
gulp.task('clean:css', function() {
  return del(['public/dist/*.css']);
});

// CSS styles task
gulp.task('styles', function() {

  // In production mode:
  if (process.env.NODE_ENV === 'production') {

    var cssStream = gulp.src(defaultAssets.client.lib.css)
        .pipe(plugins.concat('css-files.css'));

    var lessStream = gulp.src( _.union(defaultAssets.client.lib.less, defaultAssets.client.less) )
        .pipe(plugins.concat('less-files.less'))
        .pipe(plugins.less());

    // Combine CSS and LESS streams into one minified css file
    return MergeStream(lessStream, cssStream)
      .pipe(plugins.concat('application.css'))
      .pipe(plugins.autoprefixer())
    	.pipe(plugins.csso())
    	.pipe(plugins.rename({suffix: '.min'}))
      .pipe(gulp.dest('public/dist'));
  }
  // In development mode:
  else {
    // Process only LESS files, since CSS libs will be linked directly at the template
    return gulp.src( _.union(defaultAssets.client.lib.less, defaultAssets.client.less) )
      .pipe(plugins.concat('less-files.less'))
      .pipe(plugins.less())
      .pipe(plugins.autoprefixer())
    	.pipe(plugins.rename({basename: 'application', extname: '.css'}))
      .pipe(gulp.dest('public/dist'))
      .pipe(plugins.livereload());
  }
});

// Angular UI-Boostrap template cache task
// We're not using prebuild UI-Boostraps so that
// we can pick modules we need. Therefore we need
// to manually compile our UIB templates.
gulp.task('uibTemplatecache', function() {

  // UIB module templates to include
  var uibModules = [
    'accordion',
    'modal',
    'popover',
    'progressbar',
    'tabs',
    'tooltip',
    'typeahead'
  ];

  var uibModulesStreams = new MergeStream();

  // Loop module names trough
  uibModules.forEach(function(uibModule) {

    var moduleStream = gulp.src(['public/lib/angular-ui-bootstrap/template/' + uibModule + '/*.html'])
      .pipe(plugins.htmlmin())
      .pipe(plugins.templateCache('uib-templates-' + uibModule + '.js', {
        root: 'uib/template/' + uibModule + '/',
        module: 'core',
        templateHeader: '(function(){ \'use strict\'; angular.module(\'<%= module %>\'<%= standalone %>).run(templates); templates.$inject = [\'$templateCache\']; function templates($templateCache) {',
        templateBody: '$templateCache.put(\'<%= url %>\', \'<%= contents %>\');',
        templateFooter: '} })();'
      }));

      // Combine with previouly processed templates
      uibModulesStreams.add(moduleStream);
  });

  // Output all tempaltes to one file
  uibModulesStreams
    .pipe(plugins.concat('uib-templates.js'))
    .pipe(gulp.dest('public/dist'));

});

// Angular template cache task
gulp.task('templatecache', function() {
  return gulp.src(defaultAssets.client.views)
    .pipe(plugins.htmlmin())
    .pipe(plugins.templateCache('templates.js', {
      root: 'modules/',
      module: 'core',
      templateHeader: '(function(){ \'use strict\'; angular.module(\'<%= module %>\'<%= standalone %>).run(templates); templates.$inject = [\'$templateCache\']; function templates($templateCache) {',
      templateBody: '$templateCache.put(\'<%= url %>\', \'<%= contents %>\');',
      templateFooter: '} })();'
    }))
    .pipe(gulp.dest('public/dist'));
});

// Generate font icon files from Fontello.com
gulp.task('fontello', function(done) {
  return gulp.src(defaultAssets.server.fontelloConfig)
    .pipe(plugins.fontello( {
      font:       'font', // Destination dir for Fonts and Glyphs
      css:        'css',  // Destination dir for CSS Styles,
      assetsOnly: true    // extract from ZipFile only CSS Styles and Fonts exclude config.json, LICENSE.txt, README.txt and demo.html
    }))
    .pipe(plugins.print())
    .pipe(gulp.dest('modules/core/client/fonts/fontello'))
    .pipe(plugins.livereload());
});

// Make sure upload directory exists
gulp.task('makeUploadsDir', function() {

  // Loading this before `env:*` task will load configs with wrong environment
  var config = require('./config/config');

  return fs.mkdir(config.uploadDir, function(err) {
    if (err && err.code !== 'EEXIST') {
      console.error(err);
    }
  });
});

// Run Selenium tasks
gulp.task('selenium', plugins.shell.task('python ./scripts/selenium/test.py'));

// Mocha tests task
gulp.task('mocha', function(done) {
  // Open mongoose connections
  var mongoose = require('./config/lib/mongoose');
  var testSuites = Array.isArray(argv.changedTestFiles) && argv.changedTestFiles.length ? argv.changedTestFiles : testAssets.tests.server;
  var error;

  // Connect mongoose
  mongoose.connect(function() {
    mongoose.loadModels();
    // Run the tests
    gulp.src(testSuites)
      .pipe(plugins.mocha({
        reporter: 'spec',
        timeout: 10000
      }))
      .on('error', function(err) {
        // If an error occurs, save it
        error = err;
        console.error(err);
      })
      .on('end', function() {
        // When the tests are done, disconnect mongoose and pass the error state back to gulp
        mongoose.disconnect(function() {
          done(error);
        });
      });
  });

});

// Karma test runner task
gulp.task('karma', function(done) {
  new KarmaServer({
    configFile: __dirname + '/karma.conf.js',
    singleRun: true
  }, done).start();
});

// Build assets for development mode
gulp.task('build:dev', function(done) {
  runSequence('env:dev', 'bower', 'jshint', 'clean', ['uibTemplatecache', 'styles'], done);
});

// Build assets for production mode
gulp.task('build:prod', function(done) {
  runSequence('env:prod', 'bower', 'jshint', 'clean', 'templatecache', 'uibTemplatecache', ['styles', 'scripts'], done);
});

// Clean dist css and js files
gulp.task('clean', function(done) {
  runSequence(['clean:css', 'clean:js'], done);
});

// Run the project tests
gulp.task('test', function(done) {
  runSequence('env:test', ['copyConfig', 'makeUploadsDir'], 'jshint', ['karma', 'mocha'], done);
});

gulp.task('test:server', function(done) {
  runSequence('env:test', ['copyConfig', 'makeUploadsDir'], 'jshint', 'mocha', done);
});

// Watch all server files for changes & run server tests (test:server) task on changes
// optional arguments:
//    --onlyChanged - optional argument for specifying that only the tests in a changed Server Test file will be run
// example usage: gulp test:server:watch --onlyChanged
gulp.task('test:server:watch', function(done) {
  runSequence('test:server', 'watch', done);
});

gulp.task('test:client', function(done) {
  runSequence('env:test', ['copyConfig', 'makeUploadsDir'], 'jshint', 'karma', done);
});

// Run the project in development mode
gulp.task('develop', function(done) {
  runSequence('env:dev', ['copyConfig', 'makeUploadsDir'], 'build:dev', ['nodemon', 'watch'], done);
});

// Run the project in production mode
gulp.task('prod', function(done) {
  runSequence('env:prod', ['copyConfig', 'makeUploadsDir'], 'build:prod', ['nodemon', 'watch'], done);
});

// Default to develop mode
gulp.task('default', function(done) {
  runSequence('develop', done);
});
