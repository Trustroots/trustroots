const path = require('path');
const mongoose = require('mongoose');
const moment = require('moment');
const config = require(path.resolve('./config/config'));
const Experience = mongoose.model('Reference');

/**
 * Find all experiences that are older than timeToReply Experience and non-public.
 * Make them public.
 * @TODO (maybe) Notify the affected users that a reference for them was published.
 */
module.exports = function (job, agendaDone) {
  Experience.updateMany(
    {
      created: { $lt: moment().subtract(config.limits.timeToReplyReference) },
      public: false,
    },
    { public: true },
  ).exec(agendaDone);
};
