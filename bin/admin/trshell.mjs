import mongoose from 'mongoose';
import mongooseService from './../../config/lib/mongoose.mjs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let service = {};
// Ensuring that we're in the right directory
process.chdir(__dirname);
process.chdir('../../');
mongooseService.connect();
mongooseService.loadModels();
mongoose.set('debug', false);
service.mongoose = mongoose;
service.htmlFormat = function (s) {
  // Quick'n'dirty way of ditching HTML
  return s.replace(/\<.*?\>/gi, '');
};
var areWeDone = false;
service.weAreDone = function () {
  areWeDone = true;
};

// This doesn't seem right, but it does the job.
var timeout = setInterval(function () {
  if (areWeDone) {
    mongooseService.disconnect();
    clearInterval(timeout);
  }
}, 3000);
export default service;
export { service as 'module.exports' };
