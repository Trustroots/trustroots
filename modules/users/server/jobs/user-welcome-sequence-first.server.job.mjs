/**
 * Onboarding/welcome sequence email for new members: 1/3 (first one)
 *
 * Ignores users with `suspended` or `shadowban` roles.
 *
 * Keeps count of onboarding emails at user's model.
 */

/**
 * Module dependencies.
 */

// Disable all welcome emails
const defaultExport = function (job, done) {
  if (typeof done === 'function') {
    return done();
  }
};

/*








const User = mongoose.model('User');

const defaultExport = function (job, agendaDone) {
  // Ignore very recently confirmed (i.e. signed up) users
  const emailConfirmedTimeAgo = moment().subtract(
    moment.duration(config.limits.welcomeSequence.first),
  );

  async.waterfall(
    [
      // Find un-welcomed users
      function (done) {
        User.find({
          // User has confirmed their email
          public: true,

          // None of the welcome sequence emails was sent out to them yet
          welcomeSequenceStep: 0,

          // Wait for x hours after email confirmation before sending
          // the first welcome sequence email
          welcomeSequenceSent: { $lt: emailConfirmedTimeAgo },

          // Exclude users with restricted roles.
          roles: { $nin: ['suspended', 'shadowban'] },
        })
          // Limit stops any crazy amounts of emails being processed at once
          // the rest would be processed in next round.
          .limit(50)
          .exec(function (err, users) {
            done(err, users);
          });
      },

      // Send emails
      function (users, done) {
        // No users to send emails to
        if (!users.length) {
          return done();
        }

        async.eachSeries(
          users,
          function (user, callback) {
            emailService.sendWelcomeSequenceFirst(user, function (err) {
              if (err) {
                return callback(err);
              }

              // Mark reminder sent and update the reminder count
              User.findByIdAndUpdate(
                user._id,
                {
                  $set: {
                    welcomeSequenceSent: new Date(),
                  },
                  // If the field does not exist, $inc creates the field
                  // and sets the field to the specified value.
                  $inc: {
                    welcomeSequenceStep: 1,
                  },
                },
                function (err) {
                  callback(err);
                },
              );
            });
          },
          function (err) {
            done(err);
          },
        );
      },
    ],
    function (err) {
      if (err) {
        log('error', 'Failure in first welcome sequence background job.', {
          error: err,
          jobId: _.get(job, 'attrs._id').toString(),
        });
      }
      return agendaDone(err);
    },
  );
};
*/
export default defaultExport;
export { defaultExport as 'module.exports' };
