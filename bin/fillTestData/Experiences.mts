import _ from 'lodash';
import mongooseService from './../../config/lib/mongoose.mjs';
import yargs from 'yargs';
import { faker } from '@faker-js/faker';
import mongoose, { type Document, type Types } from 'mongoose';
import queue from 'async/queue.js';
import config from './../../config/config.mjs';
import moment from 'moment';

interface SeedUser extends Document {
  _id: Types.ObjectId;
  username: string;
}

interface SeedExperience extends Document {
  userTo: Types.ObjectId;
  userFrom: Types.ObjectId;
  created: Date;
  feedbackPublic: string;
  interactions: { met: boolean; guest: boolean; host: boolean };
  recommend: 'no' | 'yes' | 'unknown';
  public: boolean;
}

interface ProfileTypes {
  noExperiences(seqNum: number): boolean;
  receivedPublic(seqNum: number): boolean;
  receivedPrivate(seqNum: number): boolean;
  isWriter(seqNum: number): boolean;
  isReplier(seqNum: number): boolean;
  getSeqNumWithManyExperiences(): number;
  prePopulatedProfilesRatio(): number;
  minimumTestableUserNumber(): number;
  isRecipient(seqNum: number): boolean;
  isPrePopulated(seqNum: number): boolean;
}

type SharingMatrix = (boolean | undefined)[][];
interface ExperienceTask {
  userTo: Types.ObjectId;
  userFrom: Types.ObjectId;
}
/**
 * Required dependencies
 */

/**
 * Configure the script usage using yargs to obtain parameters and enforce usage.
 */
const argv = yargs(process.argv.slice(2))
  .usage('$0 <averageNumberPerProfile> <replyRate>')
  .command(
    '$0 <averageNumberPerProfile> <replyRate>',
    'Seed database with experiences',
  )
  .positional('averageNumberPerProfile', {
    describe:
      'Average Number of experiences a profile will have ' +
      '(except for pre-populated profiles)',
    type: 'number',
  })
  .positional('replyRate', {
    describe:
      'The probability that B will share experience with A if A shares one with B',
    type: 'number',
  })
  .boolean('debug')
  .describe('debug', 'Enable extra database output (default=false)')
  .boolean('re-create')
  .describe(
    're-create',
    'Remove existing experiences if there are any and create new ones',
  )
  .example(
    '$0 10 0.8',
    'Adds on average 10 experiences (8 of them having replies) to each profile to the database ',
  )
  .example(
    '$0 10 0.8 --re-create',
    'Adds on average 10 experiences (8 of them having replies) to each profile to the database after removing all existing experiences from the db ',
  )
  .example(
    '$0 10 0.8 --debug',
    'Adds on average 10 experiences (8 of them having replies) to each profile to the database with debug database output',
  )
  .check(function (arguments_) {
    if (
      typeof arguments_.replyRate !== 'number' ||
      arguments_.replyRate > 1 ||
      arguments_.replyRate < 0
    ) {
      throw new Error('Reply rate must be between 0 and 1');
    }
    if (
      typeof arguments_.averageNumberPerProfile !== 'number' ||
      arguments_.averageNumberPerProfile < 0
    ) {
      throw new Error('Number of experiences must be positive');
    }
    return true;
  })
  .strict()
  .parseSync();

if (
  typeof argv.averageNumberPerProfile !== 'number' ||
  typeof argv.replyRate !== 'number'
) {
  throw new Error('Average experiences and reply rate must be numbers');
}

const profileType: ProfileTypes = {
  noExperiences: seqNum => seqNum % 10 === 0,
  receivedPublic: seqNum => seqNum % 10 === 1,
  receivedPrivate: seqNum => seqNum % 10 === 2,
  isWriter: seqNum => seqNum % 10 === 3,
  isReplier: seqNum => seqNum % 10 === 4,
  getSeqNumWithManyExperiences: () => 5,
  prePopulatedProfilesRatio: () => 0.5 /* with last digit in [0, 4] */,

  minimumTestableUserNumber: () =>
    5 /* at least to have all the categories above */,

  isRecipient: function isRecipient(seqNum) {
    return (
      this.receivedPublic(seqNum) ||
      this.receivedPrivate(seqNum) ||
      this.isReplier(seqNum)
    );
  },
  isPrePopulated: function isPrePopulated(seqNum) {
    return (
      this.noExperiences(seqNum) ||
      this.isRecipient(seqNum) ||
      this.isWriter(seqNum)
    );
  },
};
const experienceGenerator = {
  interactions: (to = Number.NaN, from = Number.NaN) => ({
    met: true,
    guest: to < from,
    host: from < to,
  }),
  recommendation: () => {
    const r = Math.random();
    return r < 0.1 ? 'no' : r < 0.3 ? 'yes' : 'unknown';
  },
  public: (to = Number.NaN) =>
    Math.random() < 0.9 && !profileType.receivedPrivate(to),
  created: () =>
    moment()
      .subtract({
        days: _.random(14),
      })
      .toDate(),
  feedbackPublic: () => faker.lorem.sentences(),
};

/**
 * This method generates an {nUsers} x {nUsers} experience sharing matrix M.
 * M[i][j] === true if and only if an experience of user[j] shared with user[i] is to be added to the db.
 * In other words, the array M[i] defines experiences to be present in the profile of User i.
 *
 * To cover different cases, the generation is done as follows:
 * 1. Make sure there are profiles with no experiences,
 * one experience with and without reply, and
 * profiles with only one non-public experience.
 * 2. Populate one profile with as many experiences as possible.
 * 3. Populate the rest of the profiles randomly according to the specified
 * {averageExpNumber} and {replyRate}.
 *
 * @param {number} nUsers - the number of users in the db
 * @param {number} averageExpNumber - the average number of experiences a randomly populated profile has
 * @param {number} replyRate - the probability for a randomly populated experience to have a reply
 * @returns {*[]} user experience sharing matrix
 */
function generateExperienceSharingMatrix(
  nUsers: number,
  averageExpNumber: number,
  replyRate: number,
): SharingMatrix {
  const matrix = Array(nUsers)
    .fill(undefined)
    .map(() => Array<boolean | undefined>(nUsers).fill(undefined));

  // cannot share experience with myself
  Array.from(
    {
      length: nUsers,
    },
    (x, i) => (matrix[i][i] = false),
  );
  prePopulate(matrix);
  populateOneProfileWithLotsOfExperiences(matrix, replyRate);
  populateRandomly(matrix, averageExpNumber, replyRate);
  return matrix;
  function prePopulate(expMatrix: SharingMatrix) {
    const fromSameBatch = function differsOnlyLastDigit(x: number, y: number) {
      return Math.floor(x / 10) === Math.floor(y / 10);
    };
    const pt = profileType;
    for (let to = 0; to < expMatrix.length; to++) {
      for (let from = 0; from < expMatrix.length; from++) {
        if (
          fromSameBatch(from, to) &&
          ((pt.isWriter(from) && pt.isRecipient(to)) ||
            (pt.isReplier(from) && pt.isWriter(to)))
        ) {
          expMatrix[to][from] = true;
        } else if (pt.isPrePopulated(to) || pt.isPrePopulated(from)) {
          expMatrix[to][from] = false;
        }
      }
    }
  }
  function populateOneProfileWithLotsOfExperiences(
    expMatrix: SharingMatrix,
    replyRate: number,
  ) {
    const profileWithManyExperiences =
      profileType.getSeqNumWithManyExperiences();
    for (let from = 0; from < expMatrix.length; from++) {
      if (
        profileWithManyExperiences !== from &&
        !profileType.isPrePopulated(from)
      ) {
        const shouldReply = Math.random() < replyRate;
        expMatrix[profileWithManyExperiences][from] = true;
        expMatrix[from][profileWithManyExperiences] = shouldReply;
      }
    }
  }
  function populateRandomly(
    expMatrix: SharingMatrix,
    averageExpNumber: number,
    replyRate: number,
  ) {
    function getExperienceSharingRate(
      nUsers: number,
      averageExpNumber: number,
      replyRate: number,
    ) {
      averageExpNumber /= 1 + replyRate;
      let expSharingRate =
        averageExpNumber /
        (nUsers * (1 - profileType.prePopulatedProfilesRatio()));
      if (expSharingRate > 1) {
        expSharingRate = 1;
      }
      return expSharingRate;
    }
    const pt = profileType;
    const experienceSharingRate = getExperienceSharingRate(
      expMatrix.length,
      averageExpNumber,
      replyRate,
    );
    const profileWithManyExperiences = pt.getSeqNumWithManyExperiences();
    for (let to = 1; to < expMatrix.length; to++) {
      for (let from = 0; from < to; from++) {
        if (
          !pt.isPrePopulated(to) &&
          !pt.isPrePopulated(from) &&
          to !== from &&
          profileWithManyExperiences !== to &&
          profileWithManyExperiences !== from
        ) {
          const shouldShareExperience = Math.random() < experienceSharingRate;
          const shouldReply = Math.random() < replyRate;
          expMatrix[to][from] = shouldShareExperience;
          expMatrix[from][to] = shouldShareExperience && shouldReply;
        }
      }
    }
  }
}
function seedExperiences(averageExpNumber: number, replyRate: number) {
  const debug = argv.debug === true;
  console.log('--');
  console.log('Trustroots test experiences data');
  console.log('--');

  // Override debug mode to use the option set by the user
  config.db.debug = debug;
  mongooseService.connect(() => {
    mongooseService.loadModels(async () => {
      const Experience = mongoose.model<SeedExperience>('Experience');
      const User = mongoose.model<SeedUser>('User');
      const users = await User.find().sort('username');
      if (users.length < profileType.minimumTestableUserNumber()) {
        console.error(
          `At least ${profileType.minimumTestableUserNumber()} users must exist in the db to test experiences. Please create more users and run again`,
        );
        mongooseService.disconnect();
        return;
      }
      const experience = await Experience.findOne();
      if (experience && !argv.reCreate) {
        console.log(
          'Experiences already exist in the db. Use --re-create option if you want to rewrite them',
        );
      } else {
        if (experience) {
          console.log(
            'Running with --re-create option. Removing existing Experiences ...',
          );
          await Experience.deleteMany();
        }
        console.log(
          `Profile with many experiences (username): ${
            users[profileType.getSeqNumWithManyExperiences()].username
          }`,
        );
        const experienceSharingMatrix = generateExperienceSharingMatrix(
          users.length,
          averageExpNumber,
          replyRate,
        );
        const nExperiencesToBeAdded = countTrueElements(
          experienceSharingMatrix,
        );
        console.log(`Saving ${nExperiencesToBeAdded} experiences ... `);
        const experienceSaveTaskQueue = queue<ExperienceTask>(
          async (task, callback) => {
            const experience = createExperience(task.userTo, task.userFrom);
            await experience.save();
            callback();
          },
          100,
        );
        experienceSaveTaskQueue.error((err, task) => {
          console.log(
            `Error ${err} when saving experience of user ${task.userFrom} with ${task.userTo}`,
          );
        });
        const intervalObject = setInterval(() => {
          console.log(
            `Experiences still to be persisted: ${experienceSaveTaskQueue.length()}`,
          );
        }, 1000);
        experienceSaveTaskQueue.drain = function () {
          clearInterval(intervalObject);
          console.log('All experiences have been saved');
          mongooseService.disconnect();
        };
        experienceSharingMatrix.forEach((row, i) => {
          row.forEach((elem, j) => {
            if (elem) {
              experienceSaveTaskQueue.push({
                userTo: users[i]._id,
                userFrom: users[j]._id,
              });
            }
          });
        });
      }
      function createExperience(
        userTo: Types.ObjectId,
        userFrom: Types.ObjectId,
      ): SeedExperience {
        const experience = new Experience();
        experience.userTo = userTo;
        experience.userFrom = userFrom;
        experience.created = experienceGenerator.created();
        experience.feedbackPublic = experienceGenerator.feedbackPublic();
        experience.interactions = experienceGenerator.interactions();
        experience.recommend = experienceGenerator.recommendation();
        experience.public = experienceGenerator.public();
        return experience;
      }
      function countTrueElements(matrix: SharingMatrix): number {
        return matrix
          .map(row => row.filter(v => v).length)
          .reduce((a, b) => a + b, 0);
      }
    });
  });
}
seedExperiences(argv.averageNumberPerProfile, argv.replyRate);
