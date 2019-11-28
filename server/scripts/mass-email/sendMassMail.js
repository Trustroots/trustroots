const _ = require("lodash");
const async = require("async");
const shortid = require("shortid");

// nedb is a local disk backed mongo alternative for simple local scripts
const Datastore = require("nedb");
const Users = new Datastore({ filename: "data/users.db", autoload: true });

// Instantiate sparkpost which reads the key from SPARKPOST_API_KEY
const SparkPost = require("sparkpost");
const spClient = new SparkPost();

// We use this as a template and add the `recipients` later
const baseTransmission = {
  campaign_id: "invite-only",
  content: {
    template_id: "mass-email"
  }
};

// How long should we wait between each iteration of the sending loop
const interval = 60 * 1e3; // 1 minute
// This should equal about 15k messages per day, which should keep us below our
// SparkPost limit of 20k per day
const usersPerApiCall = 10;
const totalRuns = 5000;

const userToRecipient = function(user) {
  return {
    address: {
      // Sparkpost wants the email like `address.email`
      email: _.get(user, "email"),
      name: _.get(user, "displayName")
    },
    // Build the `substitution_data` property from all the properties which are
    // not the email address in `user`
    substitution_data: _.omit(user, "email")
  };
};

// Grab n records and whip through them
const sendOneGroup = function(i, eachCb) {
  // Log the time of successful delivery
  const when = new Date();
  const batchId = shortid.generate();

  // Log this group iteration
  console.log(
    new Date(),
    `INFO: Starting group number ${++i} with id ${batchId}`
  );

  const cursor = Users.find({ sentAt: { $exists: false } })
    .limit(usersPerApiCall)
    .exec((err, users) => {
      // If we've run out of users, stop here
      if (users.length === 0) {
        console.log(new Date(), "SUCCESS: All emails sent");
        return eachCb("finished");
      }

      // Build the recipients object
      const recipients = _.map(users, userToRecipient);

      // Build the transmission object
      const transmission = _.extend({}, baseTransmission, { recipients });

      // Send the request to sparkpost
      spClient.transmissions.send(transmission, (err, data) => {
        // If we got an error, let's throw it, and stop the process
        if (err) {
          console.log("SPARKPOST ERROR", err, data, users);

          // Passing an error to `eachCb()` stops the loop
          return eachCb(err);
        }

        // Record success
        _.each(users, user => {
          Users.update(
            { _id: user._id },
            { $set: { sentAt: when, sentBatchId: batchId } }
          );
        });

        // Start the next iteration after `interval`
        setTimeout(eachCb, interval);
      });
    });
};

async.timesSeries(totalRuns, sendOneGroup, err => {
  console.log(new Date(), "FINISH", err);
});
