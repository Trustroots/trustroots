module.exports = {
  client: {
    lib: {
      // Load Angular-UI-Bootstrap module templates for these modules:
      uibModuleTemplates: [
        'datepicker',
        'modal',
        'popover',
        'progressbar',
        'tabs',
        'tooltip',
        'typeahead'
      ],
      js: [
        // Non minified versions
        'node_modules/jquery/dist/jquery.js',
        'node_modules/angular/angular.js',
        'node_modules/angular-aria/angular-aria.js',
        'node_modules/angular-resource/angular-resource.js',
        'node_modules/angular-animate/angular-animate.js',
        'node_modules/angular-touch/angular-touch.js',
        'node_modules/angular-sanitize/angular-sanitize.js',
        'node_modules/angular-message-format/angular-message-format.js',
        'node_modules/angulartics/src/angulartics.js',
        'node_modules/angular-ui-router/release/angular-ui-router.js',
        'node_modules/angular-ui-bootstrap/src/buttons/buttons.js',
        'node_modules/angular-ui-bootstrap/src/collapse/collapse.js',
        'node_modules/angular-ui-bootstrap/src/dateparser/dateparser.js',
        'node_modules/angular-ui-bootstrap/src/datepicker/datepicker.js',
        'node_modules/angular-ui-bootstrap/src/debounce/debounce.js',
        'node_modules/angular-ui-bootstrap/src/dropdown/dropdown.js',
        'node_modules/angular-ui-bootstrap/src/isClass/isClass.js',
        'node_modules/angular-ui-bootstrap/src/modal/modal.js',
        'node_modules/angular-ui-bootstrap/src/multiMap/multiMap.js',
        'node_modules/angular-ui-bootstrap/src/popover/popover.js',
        'node_modules/angular-ui-bootstrap/src/position/position.js',
        'node_modules/angular-ui-bootstrap/src/progressbar/progressbar.js',
        'node_modules/angular-ui-bootstrap/src/stackedMap/stackedMap.js',
        'node_modules/angular-ui-bootstrap/src/tabs/tabs.js',
        'node_modules/angular-ui-bootstrap/src/tooltip/tooltip.js',
        'node_modules/angular-ui-bootstrap/src/typeahead/typeahead.js',
        'node_modules/moment/moment.js',
        'node_modules/angular-moment/angular-moment.js',
        'node_modules/medium-editor/dist/js/medium-editor.js',
        'node_modules/leaflet/dist/leaflet-src.js',
        'node_modules/angular-simple-logger/dist/angular-simple-logger.js', // Required by angular-leaflet-directive
        'node_modules/ui-leaflet/dist/ui-leaflet.js',
        'node_modules/leaflet-active-area/src/leaflet.activearea.js',
        'node_modules/angular-waypoints/dist/angular-waypoints.all.js',
        'node_modules/ng-file-upload/dist/ng-file-upload.js',
        'node_modules/chosen-js/chosen.jquery.js',
        'node_modules/angular-chosen-localytics/dist/angular-chosen.js',
        'node_modules/angular-loading-bar/build/loading-bar.js',
        'node_modules/angular-trustpass/dist/tr-trustpass.js',
        'node_modules/mailcheck/src/mailcheck.js',
        'node_modules/angular-mailcheck/angular-mailcheck.js',
        'node_modules/angular-locker/dist/angular-locker.js',
        'node_modules/angular-confirm/angular-confirm.js',
        'node_modules/angulargrid/angulargrid.js'
      ],
      tests: ['node_modules/angular-mocks/angular-mocks.js']
    },
    js: [
      'modules/core/client/app/config.js',
      'modules/core/client/app/init.js',
      'modules/*/client/*.js',
      'modules/*/client/controllers/*.js',
      'modules/*/client/**/*.js'
    ],
    views: ['modules/*/client/views/**/*.html']
  },
  server: {
    fontelloConfig: 'modules/core/client/fonts/fontello/config.json',
    gulpConfig: 'gulpfile.js',
    workerJS: ['worker.js', 'config/**/*.js'],
    allJS: ['server.js', 'config/**/*.js', 'modules/*/server/**/*.js'],
    models: 'modules/*/server/models/**/*.js',
    routes: ['modules/!(core)/server/routes/**/*.js', 'modules/core/server/routes/**/*.js'],
    config: 'modules/*/server/config/*.js',
    policies: 'modules/*/server/policies/*.js',
    views: 'modules/*/server/views/*.html',
    migrations: 'migrations/*.js'
  }
};
