const config = require('../../../../config/config');
const authentication = require('./authentication.server.service.cts');

exports.generateEmailToken = authentication.generateEmailToken;

exports.validateUsername = function (username) {
  return authentication.validateUsername(username, exports.isUsernameReserved);
};

exports.isUsernameReserved = function (username) {
  return authentication.isUsernameReserved(username, config.illegalStrings);
};
