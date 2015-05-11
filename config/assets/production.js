'use strict';

module.exports = {
  client: {
    lib: {
      css: [
        'public/lib/medium-editor/dist/css/medium-editor.css',
        'public/lib/leaflet/dist/leaflet.css'
      ],
      js: [
        // Minified versions
        'public/lib/jquery/dist/jquery.min.js',
        'public/lib/angular/angular.min.js',
        'public/lib/angular-resource/angular-resource.min.js',
        'public/lib/angular-animate/angular-animate.min.js',
        'public/lib/angular-touch/angular-touch.min.js',
        'public/lib/angular-sanitize/angular-sanitize.min.js',
        'public/lib/angular-ui-router/release/angular-ui-router.min.js',
        'public/lib/angular-ui-utils/ui-utils.min.js',
        'public/lib/angular-bootstrap/ui-bootstrap-tpls.min.js',
        'public/lib/moment/moment.min.js',
        'public/lib/angular-moment/angular-moment.min.js',
        'public/lib/medium-editor/dist/js/medium-editor.min.js',
        'public/lib/angular-medium-editor/dist/angular-medium-editor.min.js',
        'public/lib/leaflet/dist/leaflet.js',
        'public/lib/PruneCluster/dist/PruneCluster.min.js',
        'public/lib/angular-leaflet-directive/dist/angular-leaflet-directive.min.js',
        'public/lib/angular-waypoints/dist/angular-waypoints.all.min.js',
        'public/lib/ng-file-upload/angular-file-upload.min.js',
        'public/lib/message-center/message-center.js',
        'public/lib/chosen/chosen.jquery.min.js',
        'public/lib/angular-chosen-localytics/chosen.js'
      ]
    },
    css: 'public/dist/application.min.css',
    js: 'public/dist/application.min.js'
  }
};
