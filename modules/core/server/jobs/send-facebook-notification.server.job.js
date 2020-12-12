const _ = require('lodash');
const path = require('path');
const facebook = require(path.resolve('./config/lib/facebook-api.js'));
const log = require(path.resolve('./config/lib/logger'));

module.exports = function (job, done) {
  // Get job id from Agenda job attributes
  // Agenda stores Mongo `ObjectId` so turning that into a string here
  const jobId = _.get(job, 'attrs._id').toString();

  // Log that we're sending an email
  log('debug', 'Starting `send facebook notification` job #jdjh73', {
    jobId,
  });

  // Collect parameters for FB notification object
  // https://developers.facebook.com/docs/games/services/appnotifications#parameters
  const notification = {
    // The relative path or GET params of the target
    // (for example, `index.html?gift_id=123`, or `?gift_id=123`).
    // This will be used to construct an absolute target URL based on your app
    // settings. The logic is that, on web, if the setting exists for games on
    // Facebook.com, the target URL will comprise Game App URL + `href`. If not,
    // the notification will not be shown. The absolute URL will include some
    // special tracking params (`fb_source`, `notif_id`, `notif_t`) to the
    // target URL for developers to track at their side.
    href: job.attrs.data.href || '',

    // Notification messages are free-form text.
    template: job.attrs.data.template,
  };

  // Separate your notifications into groups so they can be tracked
  // independently in App Analytics.
  if (job.attrs.data.ref) {
    notification.ref = job.attrs.data.ref;
  }

  // Send POST to Graph API `/{recipient_userid}/notifications`
  // https://developers.facebook.com/docs/games/services/appnotifications#sendingnotifications
  // https://github.com/criso/fbgraph#publish-data-to-the-graph-api
  facebook.post(
    '/' + job.attrs.data.toUserFacebookId + '/notifications',
    notification,
    function (err) {
      if (err) {
        // Log the failure to send the notification
        log('error', 'The `send facebook notification` job failed #38hgsj', {
          jobId,
          error: err,
        });
        return done(
          new Error('Failed to communicate with Facebook Graph API. #38hgtt'),
        );
      } else {
        // Log the successful delivery of the notification
        log(
          'info',
          'Successfully finished `send facebook notification` job #39jjjd',
          {
            jobId,
          },
        );

        return done();
      }
    },
  );
};
