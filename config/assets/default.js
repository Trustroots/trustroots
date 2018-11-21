'use strict';

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
      css: [
        'node_modules/angular/angular-csp.css', // https://docs.angularjs.org/api/ng/directive/ngCsp
        'node_modules/leaflet/dist/leaflet.css',
        'node_modules/medium-editor/dist/css/medium-editor.css',
        'modules/core/client/fonts/fontello/css/tricons-codes.css',
        'node_modules/angular-ui-bootstrap/src/datepicker/datepicker.css',
        'node_modules/angular-ui-bootstrap/src/position/position.css',
        'node_modules/angular-ui-bootstrap/src/typeahead/typeahead.css',
        'node_modules/angular-ui-bootstrap/src/tooltip/tooltip.css'
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
      less: [
        'node_modules/angular-trustpass/src/tr-trustpass.less',

        // Bootstrap
        // ---------

        // Bootstrap core variables
        'node_modules/bootstrap/less/variables.less',

        // Bootstrap utility mixins
        // See the full list from 'node_modules/bootstrap/less/mixins.less'
        // Utility mixins
        'node_modules/bootstrap/less/mixins/hide-text.less',
        'node_modules/bootstrap/less/mixins/opacity.less',
        'node_modules/bootstrap/less/mixins/image.less',
        'node_modules/bootstrap/less/mixins/labels.less',
        'node_modules/bootstrap/less/mixins/reset-filter.less',
        'node_modules/bootstrap/less/mixins/resize.less',
        'node_modules/bootstrap/less/mixins/responsive-visibility.less',
        'node_modules/bootstrap/less/mixins/size.less',
        'node_modules/bootstrap/less/mixins/tab-focus.less',
        'node_modules/bootstrap/less/mixins/reset-text.less',
        'node_modules/bootstrap/less/mixins/text-emphasis.less',
        'node_modules/bootstrap/less/mixins/text-overflow.less',
        'node_modules/bootstrap/less/mixins/vendor-prefixes.less',
        // Component mixins
        'node_modules/bootstrap/less/mixins/alerts.less',
        'node_modules/bootstrap/less/mixins/buttons.less',
        'node_modules/bootstrap/less/mixins/panels.less',
        'node_modules/bootstrap/less/mixins/pagination.less',
        'node_modules/bootstrap/less/mixins/list-group.less',
        'node_modules/bootstrap/less/mixins/nav-divider.less',
        'node_modules/bootstrap/less/mixins/forms.less',
        'node_modules/bootstrap/less/mixins/progress-bar.less',
        'node_modules/bootstrap/less/mixins/table-row.less',
        // Skin mixins
        'node_modules/bootstrap/less/mixins/background-variant.less',
        'node_modules/bootstrap/less/mixins/border-radius.less',
        'node_modules/bootstrap/less/mixins/gradients.less',
        // Layout mixins
        'node_modules/bootstrap/less/mixins/clearfix.less',
        'node_modules/bootstrap/less/mixins/center-block.less',
        'node_modules/bootstrap/less/mixins/nav-vertical-align.less',
        'node_modules/bootstrap/less/mixins/grid-framework.less',
        'node_modules/bootstrap/less/mixins/grid.less',

        // Reset and dependencies
        'node_modules/bootstrap/less/normalize.less',
        // 'node_modules/bootstrap/less/print.less',
        // 'node_modules/bootstrap/less/glyphicons.less',

        // Core CSS
        'node_modules/bootstrap/less/scaffolding.less',
        'node_modules/bootstrap/less/type.less',
        // 'node_modules/bootstrap/less/code.less',
        'node_modules/bootstrap/less/grid.less',
        'node_modules/bootstrap/less/tables.less',
        'node_modules/bootstrap/less/forms.less',
        'node_modules/bootstrap/less/buttons.less',

        // Components
        'node_modules/bootstrap/less/component-animations.less',
        'node_modules/bootstrap/less/dropdowns.less',
        'node_modules/bootstrap/less/button-groups.less',
        'node_modules/bootstrap/less/input-groups.less',
        'node_modules/bootstrap/less/navs.less',
        'node_modules/bootstrap/less/navbar.less',
        // 'node_modules/bootstrap/less/breadcrumbs.less',
        // 'node_modules/bootstrap/less/pagination.less',
        // 'node_modules/bootstrap/less/pager.less',
        'node_modules/bootstrap/less/labels.less',
        'node_modules/bootstrap/less/badges.less',
        // 'node_modules/bootstrap/less/jumbotron.less',
        // 'node_modules/bootstrap/less/thumbnails.less',
        'node_modules/bootstrap/less/alerts.less',
        'node_modules/bootstrap/less/progress-bars.less',
        'node_modules/bootstrap/less/media.less',
        'node_modules/bootstrap/less/list-group.less',
        'node_modules/bootstrap/less/panels.less',
        // 'node_modules/bootstrap/less/responsive-embed.less',
        // 'node_modules/bootstrap/less/wells.less',
        'node_modules/bootstrap/less/close.less',

        // Components w/ JavaScript
        'node_modules/bootstrap/less/modals.less',
        'node_modules/bootstrap/less/tooltip.less',
        'node_modules/bootstrap/less/popovers.less',
        // 'node_modules/bootstrap/less/carousel.less',

        // Utility classes
        'node_modules/bootstrap/less/utilities.less',
        'node_modules/bootstrap/less/responsive-utilities.less'
      ],
      tests: ['node_modules/angular-mocks/angular-mocks.js']
    },
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
