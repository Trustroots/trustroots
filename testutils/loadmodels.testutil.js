var mongooseService = require('../config/lib/mongoose');

var loadModelsDone = new Promise(function (resolve) {
  mongooseService.loadModels(function () {
    resolve(true);
  });
});

loadModelsDone.then(
  function (resolved) {
    return resolved;
  }
);