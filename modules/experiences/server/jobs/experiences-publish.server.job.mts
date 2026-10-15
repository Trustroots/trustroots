import mongoose from 'mongoose';
import moment from 'moment';
import config from './../../../../config/config.mts';
const Experience = mongoose.model('Experience');

/**
 * Find all experiences that are older than timeToReplyExperience and non-public.
 * Make them public.
 *
 * @TODO Notify the affected users that a experience for them was published.
 */
function run(
  _job: unknown,
  agendaDone: (error?: Error | null, result?: unknown) => void,
) {
  Experience.updateMany(
    {
      created: {
        $lt: moment().subtract(config.limits.timeToReplyExperience),
      },
      public: false,
      removedAt: { $exists: false },
    },
    {
      public: true,
    },
  ).then(
    result => agendaDone(null, result),
    (error: Error) => agendaDone(error),
  );
}
export { run };
export default run;
export { run as 'module.exports' };
