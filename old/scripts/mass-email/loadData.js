const _ = require("lodash");
const fs = require("fs");
const async = require("async");

// nedb is a local disk backed mongo alternative for simple local scripts
const Datastore = require("nedb");
const users = new Datastore({ filename: "data/users.db", autoload: true });

// Read the mongo dump (a JSON object on one line per document)
var lines = fs.readFileSync("data/users.json", { encoding: "utf-8" });

// Split the whole thing into an array, one JSON text string for every document
var jsons = lines.split("\n");

// Rip off the last element of the array because it's an empty string
if (_.last(jsons) === "") {
  jsons.pop();
}

var count = 0;

async.eachSeries(
  jsons,
  (json, eachCb) => {
    try {
      var doc = JSON.parse(json);
    } catch (e) {
      console.log("wtf???", e);
      // Don't pass an error or it will break the async loop
      return eachCb();
    }

    // If this user is not public, then skip this iteration
    if (!_.get(doc, "public", false)) {
      // Don't pass an error or it will break the async loop
      return eachCb();
    }

    // Build a user object for the persistence layer. First pick out the fields we want then merge in the user_id
    const user = _.extend(
      _.pick(doc, [
        "displayName",
        "email",
        "firstName",
        "lastName",
        "locationFrom",
        "locationLiving",
        "username"
      ]),
      {
        _id: _.get(doc, "_id.$oid")
      }
    );

    // Count how many records we've processed
    count++;

    // Insert the user into the nedb store
    users.insert(user, err => {
      if (err) {
        console.error("nedb insert error", err);
      }
      eachCb();
    });
  },
  err => {
    console.log("count", count);
  }
);
