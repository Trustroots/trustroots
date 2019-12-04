const path = require('path');
const mongoose = require('mongoose');
const moment = require('moment');
const config = require(path.resolve('./config/config'));
const Reference = mongoose.model('Reference');

/**
 * Find all references that are older than timeToReply Reference and non-public.
 * Make them public.
 * @TODO (maybe) Notify the affected users that a reference for them was published.
 */
module.exports = function (job, agendaDone) {
  Reference.updateMany({
    created: { $lt: moment().subtract(config.limits.timeToReplyReference) },
    public: false
  }, { public: true }).exec(agendaDone);
};
