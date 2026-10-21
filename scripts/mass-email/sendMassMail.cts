interface MailRecord extends Record<string, unknown> {
  _id?: unknown;
}
type Done = (error?: unknown) => void;
interface MailStore {
  insert(record: MailRecord, callback: Done): void;
  find(query: Record<string, unknown>): {
    limit(count: number): {
      exec(callback: (error: unknown, records: MailRecord[]) => void): unknown;
    };
  };
  update(
    query: Record<string, unknown>,
    changes: Record<string, unknown>,
  ): void;
}
type StoreConstructor = new (options: {
  filename: string;
  autoload: boolean;
}) => MailStore;
const _ = require('lodash') as typeof import('lodash');
const shortid = require('shortid') as { generate(): string };

// nedb is a local disk backed mongo alternative for simple local scripts
const Datastore = require('nedb') as StoreConstructor;
const Users = new Datastore({ filename: 'data/users.db', autoload: true });

// Instantiate sparkpost which reads the key from SPARKPOST_API_KEY
interface Recipient {
  address: { email: unknown; name: unknown };
  substitution_data: Record<string, unknown>;
}
interface Transmission {
  campaign_id: string;
  content: { template_id: string };
  recipients: Recipient[];
}
const SparkPost = require('sparkpost') as new () => {
  transmissions: {
    send(
      transmission: Transmission,
      callback: (error: unknown, result: unknown) => void,
    ): void;
  };
};
const spClient = new SparkPost();

// We use this as a template and add the `recipients` later
const baseTransmission = {
  campaign_id: 'invite-only',
  content: {
    template_id: 'mass-email',
  },
};

// How long should we wait between each iteration of the sending loop
const interval = 60 * 1e3; // 1 minute
// This should equal about 15k messages per day, which should keep us below our
// SparkPost limit of 20k per day
const usersPerApiCall = 10;
const totalRuns = 5000;

const userToRecipient = function (user: MailRecord): Recipient {
  return {
    address: {
      // Sparkpost wants the email like `address.email`
      email: _.get(user, 'email'),
      name: _.get(user, 'displayName'),
    },
    // Build the `substitution_data` property from all the properties which are
    // not the email address in `user`
    substitution_data: _.omit(user, 'email'),
  };
};

// Grab n records and whip through them
const sendOneGroup = function (i: number, eachCb: Done) {
  // Log the time of successful delivery
  const when = new Date();
  const batchId = shortid.generate();

  // Log this group iteration
  console.log(
    new Date(),
    `INFO: Starting group number ${++i} with id ${batchId}`,
  );

  Users.find({ sentAt: { $exists: false } })
    .limit(usersPerApiCall)
    .exec((err, users) => {
      // If we've run out of users, stop here
      if (users.length === 0) {
        console.log(new Date(), 'SUCCESS: All emails sent');
        return eachCb('finished');
      }

      // Build the recipients object
      const recipients = _.map(users, userToRecipient);

      // Build the transmission object
      const transmission = _.extend({}, baseTransmission, { recipients });

      // Send the request to sparkpost
      spClient.transmissions.send(transmission, (err, data) => {
        // If we got an error, let's throw it, and stop the process
        if (err) {
          console.log('SPARKPOST ERROR', err, data, users);

          // Passing an error to `eachCb()` stops the loop
          return eachCb(err);
        }

        // Record success
        _.each(users, user => {
          Users.update(
            { _id: user._id },
            { $set: { sentAt: when, sentBatchId: batchId } },
          );
        });

        // Start the next iteration after `interval`
        setTimeout(eachCb, interval);
      });
    });
};

const sendAllGroups = async function () {
  for (let i = 0; i < totalRuns; i++) {
    await new Promise<void>((resolve, reject) => {
      sendOneGroup(i, err => (err ? reject(err) : resolve()));
    });
  }
};

sendAllGroups().then(
  () => {
    console.log(new Date(), 'FINISH', null);
  },
  err => {
    console.log(new Date(), 'FINISH', err);
  },
);
