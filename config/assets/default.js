'use strict';

module.exports = {
  client: {
    lib: {
      // Load Angular-UI-Bootstrap module templates for these modules:
      uibModuleTemplates: [
        'modal',
        'popover',
        'progressbar',
        'tabs',
        'tooltip',
        'typeahead'
      ],
      css: [
        'public/lib/fontello/css/animation.css',
        'public/lib/medium-editor/dist/css/medium-editor.css',
        'modules/core/client/fonts/fontello/css/tricons-codes.css',
        'public/lib/angular-ui-bootstrap/src/position/position.css',
        'public/lib/angular-ui-bootstrap/src/typeahead/typeahead.css',
        'public/lib/angular-ui-bootstrap/src/tooltip/tooltip.css'
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
        'public/lib/angulartics/src/angulartics.js',
        'public/lib/angular-ui-router/release/angular-ui-router.js',
        'public/lib/angular-ui-bootstrap/src/buttons/buttons.js',
        'public/lib/angular-ui-bootstrap/src/collapse/collapse.js',
        'public/lib/angular-ui-bootstrap/src/dateparser/dateparser.js',
        'public/lib/angular-ui-bootstrap/src/debounce/debounce.js',
        'public/lib/angular-ui-bootstrap/src/dropdown/dropdown.js',
        'public/lib/angular-ui-bootstrap/src/modal/modal.js',
        'public/lib/angular-ui-bootstrap/src/popover/popover.js',
        'public/lib/angular-ui-bootstrap/src/position/position.js',
        'public/lib/angular-ui-bootstrap/src/progressbar/progressbar.js',
        'public/lib/angular-ui-bootstrap/src/stackedMap/stackedMap.js',
        'public/lib/angular-ui-bootstrap/src/tabs/tabs.js',
        'public/lib/angular-ui-bootstrap/src/tooltip/tooltip.js',
        'public/lib/angular-ui-bootstrap/src/typeahead/typeahead.js',
        'public/lib/moment/moment.js',
        'public/lib/angular-moment/angular-moment.js',
        'public/lib/medium-editor/dist/js/medium-editor.js',
        'public/lib/leaflet/dist/leaflet-src.js',
        'public/lib/angular-simple-logger/dist/angular-simple-logger.js', // Required by angular-leaflet-directive
        'public/lib/PruneCluster/dist/PruneCluster.js',
        'public/lib/ui-leaflet/dist/ui-leaflet.js',
        'public/lib/leaflet-active-area/src/leaflet.activearea.js',
        'public/lib/angular-waypoints/dist/angular-waypoints.all.js',
        'public/lib/ng-file-upload/ng-file-upload.js',
        'public/lib/message-center/message-center.js',
        'public/lib/chosen/chosen.jquery.js',
        'public/lib/angular-chosen-localytics/dist/angular-chosen.js',
        'public/lib/angular-loading-bar/build/loading-bar.js',
        'public/lib/angular-trustpass/dist/tr-trustpass.js',
        'public/lib/mailcheck/src/mailcheck.js',
        'public/lib/angular-mailcheck/angular-mailcheck.js',
        'public/lib/angular-locker/dist/angular-locker.js',
        'public/lib/angular-confirm-modal/angular-confirm.js',
        'public/lib/angulargrid/angulargrid.js'
      ],
      less: [
        'public/lib/angular-trustpass/src/tr-trustpass.less',

        // Bootstrap
        // ---------

        // Bootstrap core variables
        'public/lib/bootstrap/less/variables.less',

        // Bootstrap utility mixins
        // See the full list from 'public/lib/bootstrap/less/mixins.less'
        // Utility mixins
        'public/lib/bootstrap/less/mixins/hide-text.less',
        'public/lib/bootstrap/less/mixins/opacity.less',
        'public/lib/bootstrap/less/mixins/image.less',
        'public/lib/bootstrap/less/mixins/labels.less',
        'public/lib/bootstrap/less/mixins/reset-filter.less',
        'public/lib/bootstrap/less/mixins/resize.less',
        'public/lib/bootstrap/less/mixins/responsive-visibility.less',
        'public/lib/bootstrap/less/mixins/size.less',
        'public/lib/bootstrap/less/mixins/tab-focus.less',
        'public/lib/bootstrap/less/mixins/reset-text.less',
        'public/lib/bootstrap/less/mixins/text-emphasis.less',
        'public/lib/bootstrap/less/mixins/text-overflow.less',
        'public/lib/bootstrap/less/mixins/vendor-prefixes.less',
        // Component mixins
        'public/lib/bootstrap/less/mixins/alerts.less',
        'public/lib/bootstrap/less/mixins/buttons.less',
        'public/lib/bootstrap/less/mixins/panels.less',
        'public/lib/bootstrap/less/mixins/pagination.less',
        'public/lib/bootstrap/less/mixins/list-group.less',
        'public/lib/bootstrap/less/mixins/nav-divider.less',
        'public/lib/bootstrap/less/mixins/forms.less',
        'public/lib/bootstrap/less/mixins/progress-bar.less',
        'public/lib/bootstrap/less/mixins/table-row.less',
        // Skin mixins
        'public/lib/bootstrap/less/mixins/background-variant.less',
        'public/lib/bootstrap/less/mixins/border-radius.less',
        'public/lib/bootstrap/less/mixins/gradients.less',
        // Layout mixins
        'public/lib/bootstrap/less/mixins/clearfix.less',
        'public/lib/bootstrap/less/mixins/center-block.less',
        'public/lib/bootstrap/less/mixins/nav-vertical-align.less',
        'public/lib/bootstrap/less/mixins/grid-framework.less',
        'public/lib/bootstrap/less/mixins/grid.less',


        // Reset and dependencies
        'public/lib/bootstrap/less/normalize.less',
        'public/lib/bootstrap/less/print.less',
        // 'public/lib/bootstrap/less/glyphicons.less',

        // Core CSS
        'public/lib/bootstrap/less/scaffolding.less',
        'public/lib/bootstrap/less/type.less',
        // 'public/lib/bootstrap/less/code.less',
        'public/lib/bootstrap/less/grid.less',
        'public/lib/bootstrap/less/tables.less',
        'public/lib/bootstrap/less/forms.less',
        'public/lib/bootstrap/less/buttons.less',

        // Components
        'public/lib/bootstrap/less/component-animations.less',
        'public/lib/bootstrap/less/dropdowns.less',
        'public/lib/bootstrap/less/button-groups.less',
        'public/lib/bootstrap/less/input-groups.less',
        'public/lib/bootstrap/less/navs.less',
        'public/lib/bootstrap/less/navbar.less',
        // 'public/lib/bootstrap/less/breadcrumbs.less',
        // 'public/lib/bootstrap/less/pagination.less',
        // 'public/lib/bootstrap/less/pager.less',
        'public/lib/bootstrap/less/labels.less',
        'public/lib/bootstrap/less/badges.less',
        // 'public/lib/bootstrap/less/jumbotron.less',
        // 'public/lib/bootstrap/less/thumbnails.less',
        'public/lib/bootstrap/less/alerts.less',
        'public/lib/bootstrap/less/progress-bars.less',
        'public/lib/bootstrap/less/media.less',
        'public/lib/bootstrap/less/list-group.less',
        'public/lib/bootstrap/less/panels.less',
        // 'public/lib/bootstrap/less/responsive-embed.less',
        // 'public/lib/bootstrap/less/wells.less',
        'public/lib/bootstrap/less/close.less',

        // Components w/ JavaScript
        'public/lib/bootstrap/less/modals.less',
        'public/lib/bootstrap/less/tooltip.less',
        'public/lib/bootstrap/less/popovers.less',
        // 'public/lib/bootstrap/less/carousel.less',

        // Utility classes
        'public/lib/bootstrap/less/utilities.less',
        'public/lib/bootstrap/less/responsive-utilities.less'
      ],
      tests: ['public/lib/angular-mocks/angular-mocks.js']
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
    views: 'modules/*/server/views/*.html'
  }
};
