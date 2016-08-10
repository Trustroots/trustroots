
var path = require('path'),
    config = require(path.resolve('./config/config'));

module.exports.catchEmails = function() {

  var sentEmails = [],
      originalMailerOptions;

  beforeEach(function() {
    sentEmails.length = 0;
    originalMailerOptions = config.mailer.options;
    config.mailer.options = {
      name: 'testsend',
      version: '1',
      send: function(data, callback) {
        sentEmails.push(data);
        callback();
      },
      logger: false
    };
  });

  afterEach(function() {
    config.mailer.options = originalMailerOptions;
  });

  return sentEmails;

};
