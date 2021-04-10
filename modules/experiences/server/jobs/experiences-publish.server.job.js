const path = require('path');
const mongoose = require('mongoose');
const moment = require('moment');
const config = require(path.resolve('./config/config'));
const Experience = mongoose.model('Experience');

/**
 * Find all experiences that are older than timeToReplyExperience and non-public.
 * Make them public.
 *
 * @TODO Notify the affected users that a experience for them was published.
 */
module.exports = function (job, agendaDone) {
  Experience.updateMany(
    {
      created: { $lt: moment().subtract(config.limits.timeToReplyExperience) },
      public: false,
    },
    { public: true },
  ).exec(agendaDone);
};
