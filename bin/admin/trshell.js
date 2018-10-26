'use strict'

// Ensuring that we're in the right directory
process.chdir(__dirname);
process.chdir('../../');

var mongoose = require('mongoose');
var path = require('path');
var mongooseService = require(path.resolve('config/lib/mongoose'));

mongooseService.connect();
mongooseService.loadModels();
mongoose.set('debug', false);

module.exports.disconnect = mongooseService.disconnect
