// Ensuring that we're in the right directory
process.chdir(__dirname);
process.chdir('../../');

var mongoose = require('mongoose');
var path = require('path');
var mongooseService = require(path.resolve('config/lib/mongoose'));

mongooseService.connect();
mongooseService.loadModels();
mongoose.set('debug', false);

module.exports.mongoose = mongoose;


module.exports.htmlFormat = function(s) {
  // Quick'n'dirty way of ditching HTML
  return (s.replace(/\<.*?\>/gi, ''));
}


var areWeDone = false;

module.exports.weAreDone = function() { areWeDone = true; };

// This doesn't seem right, but it does the job.
var timeout = setInterval(function() {
  if (areWeDone) {
    mongooseService.disconnect();
    clearInterval(timeout);
  }
}, 3000);
