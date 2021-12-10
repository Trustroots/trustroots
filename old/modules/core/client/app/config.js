/* eslint no-var: 0 */

import angular from 'angular';
import compact from 'lodash/compact';

import bootstrapModules from '@/config/client/bootstrap';

import ngAria from 'angular-aria';
import ngResource from 'angular-resource';
import ngAnimate from 'angular-animate';
import ngTouch from 'angular-touch';
import ngSanitize from 'angular-sanitize';
import ngMessageFormat from 'angular-message-format';
import 'angulartics/src/angulartics'; // provides 'angulartics' module

import uiRouter from 'angular-ui-router';

import angularMoment from 'angular-moment';
import 'angular-simple-logger'; // provides 'nemLogger' module
import 'ui-leaflet'; // provides 'ui-leaflet' module
import 'leaflet-active-area/src/leaflet.activearea';

import ngFileUpload from 'ng-file-upload';

import 'angular-chosen-localytics';
import 'angular-loading-bar';
import trTrustpass from 'angular-trustpass';
import 'mailcheck'; // required for angular-mailcheck
import 'angular-mailcheck'; // provides 'angular-mailcheck' module
import angularLocker from 'angular-locker';
import 'angular-confirm'; // provides 'angular-confirm' module
import angularGrid from 'angulargrid';

import 'chosen-js/chosen.jquery.js';
import 'angular-chosen-localytics/dist/angular-chosen.js';

import ngreact from 'ngreact';

// eslint-disable-next-line angular/window-service
const SENTRY_DSN = window.SENTRY_DSN;

if (SENTRY_DSN) {
  require('@/config/client/sentry').init(SENTRY_DSN);
}

/**
 * Init the application configuration module for AngularJS application
 * Init module configuration options
 */
const appEnv = process.env.NODE_ENV || 'test';

const appModuleName = 'trustroots';
const appModuleVendorDependencies = compact([
  ngreact.name,
  ngAria,
  ngResource,
  ngAnimate,
  ngTouch,
  ngSanitize,
  ngMessageFormat,
  'angulartics',
  uiRouter,
  angularMoment,
  'nemLogging',
  'ui-leaflet',
  ngFileUpload,
  'localytics.directives',
  'angular-loading-bar',
  trTrustpass,
  'angular-mailcheck',
  angularLocker,
  'angular-confirm',
  angularGrid,
  SENTRY_DSN && 'ngSentry',
  ...bootstrapModules,
]);

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
const registerModule = function (moduleName, dependencies) {
  // Create angular module
  angular.module(moduleName, dependencies || []);

  // Add the module to the AngularJS configuration file
  angular.module(appModuleName).requires.push(moduleName);
};

export default {
  appEnv,
  appModuleName,
  appModuleVendorDependencies,
  registerModule,
};
