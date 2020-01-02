/* eslint no-var: 0 */

import angular from 'angular';

import ngAria from 'angular-aria';
import ngResource from 'angular-resource';
import ngAnimate from 'angular-animate';
import ngTouch from 'angular-touch';
import ngSanitize from 'angular-sanitize';
import ngMessageFormat from 'angular-message-format';
import 'angulartics/src/angulartics'; // provides 'angulartics' module

import uiRouter from 'angular-ui-router';

// @TODO: perhaps move this bootstrap imports into their own place...? also with the .html imports from main.js?
import 'angular-ui-bootstrap/src/buttons/buttons';
import 'angular-ui-bootstrap/src/collapse/collapse';
import 'angular-ui-bootstrap/src/dateparser/dateparser';
import 'angular-ui-bootstrap/src/datepicker/datepicker';
import 'angular-ui-bootstrap/src/debounce/debounce';
import 'angular-ui-bootstrap/src/dropdown/dropdown';
import 'angular-ui-bootstrap/src/isClass/isClass';
import 'angular-ui-bootstrap/src/modal/modal';
import 'angular-ui-bootstrap/src/multiMap/multiMap';
import 'angular-ui-bootstrap/src/popover/popover';
import 'angular-ui-bootstrap/src/position/position';
import 'angular-ui-bootstrap/src/progressbar/progressbar';
import 'angular-ui-bootstrap/src/stackedMap/stackedMap';
import 'angular-ui-bootstrap/src/tabs/tabs';
import 'angular-ui-bootstrap/src/tooltip/tooltip';
import 'angular-ui-bootstrap/src/typeahead/typeahead';

import angularMoment from 'angular-moment';
import 'angular-simple-logger'; // provides 'nemLogger' module
import 'ui-leaflet'; // provides 'ui-leaflet' module
import 'leaflet-active-area/src/leaflet.activearea';

import ngFileUpload from 'ng-file-upload';

import 'angular-chosen-localytics';
import 'angular-loading-bar';
import trTrustpass from 'angular-trustpass';
import 'angular-mailcheck'; // provides 'angular-mailcheck' module
import angularLocker from 'angular-locker';
import 'angular-confirm'; // provides 'angular-confirm' module
import angularGrid from 'angulargrid';

import 'chosen-js/chosen.jquery.js';
import 'angular-chosen-localytics/dist/angular-chosen.js';

import ngreact from 'ngreact';

// @TODO can I import it properly in tests? seems tricky as it expects this.angular to exist
if (process.env.NODE_ENV === 'test') {
  angular.module('zumba.angular-waypoints', []);
} else {
  require('angular-waypoints/dist/angular-waypoints.all');
}

// Init the application configuration module for AngularJS application
// Init module configuration options
// When testing, `window.env` is undefined, thus default to 'test'
// eslint-disable-next-line angular/window-service
var appEnv = process.env.NODE_ENV || 'test';

var appModuleName = 'trustroots';
var appModuleVendorDependencies = [
  ngreact.name,
  ngAria,
  ngResource,
  ngAnimate,
  ngTouch,
  ngSanitize,
  ngMessageFormat,
  'angulartics',
  uiRouter,
  'ui.bootstrap.dateparser',
  'ui.bootstrap.buttons',
  'ui.bootstrap.collapse',
  'ui.bootstrap.dropdown',
  'ui.bootstrap.modal',
  'ui.bootstrap.popover',
  'ui.bootstrap.progressbar',
  'ui.bootstrap.tabs',
  'ui.bootstrap.tooltip',
  'ui.bootstrap.typeahead',
  'ui.bootstrap.datepicker',
  angularMoment,
  'nemLogging',
  'ui-leaflet',
  ngFileUpload,
  'zumba.angular-waypoints',
  'localytics.directives',
  'angular-loading-bar',
  trTrustpass,
  'angular-mailcheck',
  // 'angular-locker',
  angularLocker,
  'angular-confirm',
  angularGrid
];

// eslint-disable-next-line no-console
// console.log('appModuleVendorDependencies', appModuleVendorDependencies);

/**
 * Load different service dependency for Angulartics depending on environment
 * @link https://github.com/angulartics/angulartics
 */
if (appEnv === 'production') {
  // @link https://github.com/angulartics/angulartics-google-analytics
  appModuleVendorDependencies.push('angulartics.google.analytics');
  require('angulartics-google-analytics/lib/angulartics-ga');
} else if (appEnv === 'development') {
  // @link https://github.com/angulartics/angulartics/blob/master/src/angulartics-debug.js
  appModuleVendorDependencies.push('angulartics.debug');
  require('angulartics/src/angulartics-debug');
} else if (appEnv === 'test') {
  appModuleVendorDependencies.push('angulartics.null');
  require('@/testutils/client/angulartics-null.testutil');
}

// Add a new vertical module
var registerModule = function (moduleName, dependencies) {
  // Create angular module
  angular.module(moduleName, dependencies || []);

  // Add the module to the AngularJS configuration file
  angular.module(appModuleName).requires.push(moduleName);
};

const AppConfig = {
  appEnv: appEnv,
  appModuleName: appModuleName,
  appModuleVendorDependencies: appModuleVendorDependencies,
  registerModule: registerModule
};

export default AppConfig;
