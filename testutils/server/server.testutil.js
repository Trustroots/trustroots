/**
 * Utility helpers for testing backend code
 */
const config = require('../../config/config');
const agenda = require('../../config/lib/agenda');

/**
 * Helper for testing Agenda jobs
 */
exports.catchJobs = function () {
  const jobs = [];
  let originalNow;

  beforeEach(function () {
    jobs.length = 0;

    // Make agenda.now() give us it's jobs
    originalNow = agenda.now;
    agenda.now = function (type, data) {
      // ensure it is plain data by serializing to json and back
      jobs.push(JSON.parse(JSON.stringify({ type, data })));

      // Resolve asynchronously, matching Agenda's promise-based API.
      return new Promise(function (resolve) {
        process.nextTick(function () {
          resolve({ attrs: { name: type, data } });
        });
      });
    };
  });

  afterEach(function () {
    // Revert all changes we made
    agenda.now = originalNow;
  });

  return jobs;
};

/**
 * Helper for testing sending emails
 * This helper just catches them up without sending them anywhere.
 */
exports.catchEmails = function () {
  const sentEmails = [];
  let originalMailerOptions;

  beforeEach(function () {
    sentEmails.length = 0;

    // Make nodemailer give us it's emails
    originalMailerOptions = config.mailer.options;
    config.mailer.options = {
      name: 'testsend',
      version: '1',
      send(data, callback) {
        sentEmails.push(data);
        callback();
      },
      logger: false,
    };
  });

  afterEach(function () {
    // Revert all changes we made
    config.mailer.options = originalMailerOptions;
  });

  return sentEmails;
};
