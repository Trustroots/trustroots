const _ = require("lodash");
const shortid = require("shortid");

// nedb is a local disk backed mongo alternative for simple local scripts
const Datastore = require("nedb");
const Users = new Datastore({ filename: "data/users.db", autoload: true });

// Grab 20 records and whip through them
const sendTwenty = function() {
  const cursor = Users.find({ sentAt: { $exists: false } })
    .limit(20)
    .exec((err, users) => {
      // Send the actual emails

      // Log the time of successful delivery
      const when = new Date();
      const batchId = shortid.generate();

      // Record success
      _.each(users, user => {
        console.log(user);
        Users.update(
          { _id: user._id },
          { $set: { sentAt: when, sentBatchId: batchId } }
        );
      });
    });
};

sendTwenty();
