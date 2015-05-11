'use strict';

module.exports = {
  client: {
    lib: {
      css: [
        'public/lib/medium-editor/dist/css/medium-editor.css',
        'public/lib/leaflet/dist/leaflet.css'
      ],
      js: [
        // Non minified  versions
        'public/lib/jquery/dist/jquery.js',
        'public/lib/angular/angular.js',
        'public/lib/angular-resource/angular-resource.js',
        'public/lib/angular-animate/angular-animate.js',
        'public/lib/angular-touch/angular-touch.js',
        'public/lib/angular-sanitize/angular-sanitize.js',
        'public/lib/angular-ui-router/release/angular-ui-router.js',
        'public/lib/angular-ui-utils/ui-utils.js',
        'public/lib/angular-bootstrap/ui-bootstrap-tpls.js',
        'public/lib/moment/moment.js',
        'public/lib/angular-moment/angular-moment.js',
        'public/lib/medium-editor/dist/js/medium-editor.js',
        'public/lib/angular-medium-editor/dist/angular-medium-editor.js',
        'public/lib/leaflet/dist/leaflet-src.js',
        'public/lib/PruneCluster/dist/PruneCluster.js',
        'public/lib/angular-leaflet-directive/dist/angular-leaflet-directive.js',
        'public/lib/angular-waypoints/dist/angular-waypoints.all.js',
        'public/lib/ng-file-upload/angular-file-upload.js',
        'public/lib/message-center/message-center.js',
        'public/lib/chosen/chosen.jquery.js',
        'public/lib/angular-chosen-localytics/chosen.js'
      ],
      tests: ['public/lib/angular-mocks/angular-mocks.js']
    },
    //css: 'public/dist/application.min.css',
    css: [
      'modules/core/client/app/css/application.css'
      //'modules/*/client/css/*.css'
    ],
    lessSrc: [
      'modules/core/client/app/less/application.less'
    ],
    less: [
      'modules/*/client/less/*.less'
    ],
    js: [
      'modules/core/client/app/config.js',
      'modules/core/client/app/init.js',
      'modules/*/client/*.js',
      'modules/*/client/**/*.js'
    ],
    views: ['modules/*/client/views/**/*.html']
  },
  server: {
    allJS: ['gruntfile.js', 'server.js', 'config/**/*.js', 'modules/*/server/**/*.js'],
    models: 'modules/*/server/models/**/*.js',
    routes: ['modules/!(core)/server/routes/**/*.js', 'modules/core/server/routes/**/*.js'],
    sockets: 'modules/*/server/sockets/**/*.js',
    config: 'modules/*/server/config/*.js',
    policies: 'modules/*/server/policies/*.js',
    views: 'modules/*/server/views/*.html'
  }
};
