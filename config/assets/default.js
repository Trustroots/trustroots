'use strict';

module.exports = {
  client: {
    lib: {
      css: [
        'public/lib/fontello/css/animation.css',
        'public/lib/fontello/css/tricons-codes.css',
        'public/lib/medium-editor/dist/css/medium-editor.css'
      ],
      js: [
        // Non minified versions
        'public/lib/jquery/dist/jquery.js',
        'public/lib/angular/angular.js',
        'public/lib/angular-aria/angular-aria.js',
        'public/lib/angular-resource/angular-resource.js',
        'public/lib/angular-animate/angular-animate.js',
        'public/lib/angular-touch/angular-touch.js',
        'public/lib/angular-sanitize/angular-sanitize.js',
        'public/lib/angular-message-format/angular-message-format.js',
        'public/lib/angular-ui-router/release/angular-ui-router.js',
        'public/lib/angular-bootstrap/ui-bootstrap-tpls.js',
        'public/lib/moment/moment.js',
        'public/lib/angular-moment/angular-moment.js',
        'public/lib/medium-editor/dist/js/medium-editor.js',
        'public/lib/angular-medium-editor/dist/angular-medium-editor.js',
        'public/lib/leaflet/dist/leaflet-src.js',
        'public/lib/angular-simple-logger/dist/index.js', // Required by angular-leaflet-directive
        'public/lib/PruneCluster/dist/PruneCluster.js',
        'public/lib/angular-leaflet-directive/dist/angular-leaflet-directive.js',
        'public/lib/angular-waypoints/dist/angular-waypoints.all.js',
        'public/lib/ng-file-upload/ng-file-upload.js',
        'public/lib/message-center/message-center.js',
        'public/lib/chosen/chosen.jquery.js',
        'public/lib/angular-chosen-localytics/chosen.js',
        'public/lib/angular-loading-bar/build/loading-bar.js',
        'public/lib/angular-trustpass/dist/tr-trustpass.js',
        'public/lib/mailcheck/src/mailcheck.js',
        'public/lib/angular-mailcheck/angular-mailcheck.js',
        'public/lib/angular-local-storage/dist/angular-local-storage.js'
      ],
      tests: ['public/lib/angular-mocks/angular-mocks.js']
    },
    css: ['modules/core/client/app/css/application.css'],
    lessSrc: [
      'modules/core/client/app/less/application.less'
    ],
    less: [
      'modules/core/client/app/less/*.less',
      'modules/core/client/less/**/*.less',
      'modules/*/client/less/*.less'
    ],
    js: [
      'modules/core/client/app/config.js',
      'modules/core/client/app/init.js',
      'modules/*/client/*.js',
      'modules/*/client/controllers/*.js',
      'modules/*/client/**/*.js'
    ],
    views: ['modules/*/client/views/**/*.html'],
    templates: ['build/templates.js']
  },
  server: {
    fontelloConfig: 'fontello.json',
    gulpConfig: 'gulpfile.js',
    allJS: ['server.js', 'config/**/*.js', 'modules/*/server/**/*.js'],
    models: 'modules/*/server/models/**/*.js',
    routes: ['modules/!(core)/server/routes/**/*.js', 'modules/core/server/routes/**/*.js'],
    config: 'modules/*/server/config/*.js',
    policies: 'modules/*/server/policies/*.js',
    views: 'modules/*/server/views/*.html'
  }
};
