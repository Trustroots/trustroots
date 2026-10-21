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
const fs = require('node:fs') as typeof import('node:fs');

// nedb is a local disk backed mongo alternative for simple local scripts
const Datastore = require('nedb') as StoreConstructor;
const users = new Datastore({ filename: 'data/users.db', autoload: true });

// Read the mongo dump (a JSON object on one line per document)
const lines = fs.readFileSync('data/users.json', { encoding: 'utf-8' });

// Split the whole thing into an array, one JSON text string for every document
const jsons = lines.split('\n');

// Rip off the last element of the array because it's an empty string
if (_.last(jsons) === '') {
  jsons.pop();
}

let count = 0;

const loadUsers = async function () {
  for (const json of jsons) {
    let doc: unknown;
    try {
      doc = JSON.parse(json);
    } catch (e) {
      console.log('wtf???', e);
      continue;
    }

    // If this user is not public, then skip this iteration
    if (!_.get(doc, 'public', false)) {
      continue;
    }

    // Build a user object for the persistence layer. First pick out the fields we want then merge in the user_id
    const user = _.extend(
      _.pick(doc as object, [
        'displayName',
        'email',
        'firstName',
        'lastName',
        'locationFrom',
        'locationLiving',
        'username',
      ]),
      {
        _id: _.get(doc, '_id.$oid'),
      },
    );

    // Count how many records we've processed
    count++;

    // Insert the user into the nedb store
    await new Promise<void>(resolve => {
      users.insert(user, err => {
        if (err) {
          console.error('nedb insert error', err);
        }
        resolve();
      });
    });
  }
};

loadUsers().then(() => {
  console.log('count', count);
});
