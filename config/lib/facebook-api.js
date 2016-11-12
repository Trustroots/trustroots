'use strict';

/**
 * Module dependencies.
 */
var fbgraph = require('fbgraph');

/**
 * Configure FB API version
 * v2.8 is available at least until October 2018
 *
 * @link https://developers.facebook.com/docs/apps/versions
 * @link https://developers.facebook.com/docs/apps/changelog
 */
fbgraph.setVersion('2.8');

module.exports = fbgraph;
