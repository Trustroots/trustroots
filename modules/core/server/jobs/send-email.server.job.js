var nodemailer = require('nodemailer'),
    path = require('path'),
    config = require(path.resolve('./config/config'));

module.exports = function(job, done) {
  var smtpTransport = nodemailer.createTransport(config.mailer.options);
  smtpTransport.sendMail(job.attrs.data, function(err) {
    smtpTransport.close(); // close the connection pool
    if (err) return done(err);
    done();
  });
};
