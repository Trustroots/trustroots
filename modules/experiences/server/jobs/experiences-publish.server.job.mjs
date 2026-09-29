import mongoose from 'mongoose';
import moment from 'moment';
import config from '../../../../config/config.js';

const Experience = mongoose.model('Experience');

/**
 * Find all experiences that are older than timeToReplyExperience and non-public.
 * Make them public.
 *
 * @TODO Notify the affected users that a experience for them was published.
 */
function run(job, agendaDone) {
  Experience.updateMany(
    {
      created: { $lt: moment().subtract(config.limits.timeToReplyExperience) },
      public: false,
    },
    { public: true },
  ).exec(agendaDone);
}

export { run };
export default run;
