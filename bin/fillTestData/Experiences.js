/**
 * Required dependencies
 */
const _ = require('lodash');
const path = require('path');
const mongooseService = require(path.resolve('./config/lib/mongoose'));
const chalk = require('chalk');
const yargs = require('yargs');
const faker = require('faker');
const mongoose = require('mongoose');
const config = require(path.resolve('./config/config'));
const util = require(path.resolve('./bin/fillTestData/util'));

/**
 * Configure the script usage using yargs to obtain parameters and enforce usage.
 */
const argv = yargs.usage(
  '$0 <averageNumberPerProfile> <replyRate>',
  'Seed database with experiences',
  yargs => {
    return yargs
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
      .boolean('force')
      .describe(
        'force',
        'Remove existing experiences if there are any and create new ones',
      )
      .example(
        '$0 10 0.8',
        'Adds on average 10 experiences (8 of them having replies) to each profile to the database ',
      )
      .example(
        '$0 10 0.8 --force',
        'Adds on average 10 experiences (8 of them having replies) to each profile to the database after removing all existing references from the db ',
      )
      .example(
        '$0 10 0.8 --debug',
        'Adds on average 10 experiences (8 of them having replies) to each profile to the database with debug database output',
      )
      .check(function (argv) {
        if (argv.replyRate > 1 || argv.replyRate < 0) {
          throw new Error('Reply rate must be between 0 and 1');
        }
        if (argv.averageNumberPerProfile < 0) {
          throw new Error('Number of experiences must be positive');
        }
        return true;
      })
      .strict().yargs;
  },
).argv;

const profileType = {
  noExperiences: function noExperiences(seqNum) {
    return seqNum % 10 === 0;
  },

  receivedPublic: function receivedPublic(seqNum) {
    return seqNum % 10 === 1;
  },

  receivedPrivate: function receivedPrivate(seqNum) {
    return seqNum % 10 === 2;
  },

  isWriter: function isWriter(seqNum) {
    return seqNum % 10 === 3;
  },

  isReplier: function isReplier(seqNum) {
    return seqNum % 10 === 4;
  },

  SEQNUM_WITH_MANY_EXPERIENCES: 5,

  prePopulatedProfilesRatio: function prePopulatedProfilesRatio() {
    return 0.5; /* with last digit in [0, 4] */
  },

  minimumTestableUserNumber: function minimumTestableUserNumber() {
    return 5; /* at least to have all the categories above */
  },

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

function generateExperienceCharacteristics(to, from) {
  function generateInteractions(to, from) {
    return {
      met: true,
      hostedMe: to < from,
      hostedThem: from < to,
    };
  }

  function generateRecommendation() {
    if (Math.random() < 0.1) {
      return 'no';
    } else if (Math.random() < 0.2) {
      return 'yes';
    } else {
      return 'unknown';
    }
  }

  return {
    recommend: generateRecommendation(),
    interactions: generateInteractions(to, from),
    public: Math.random() < 0.9 && !profileType.receivedPrivate(to),
  };
}

function generateExpCharacteristicMatrix(nUsers, averageExpNumber, replyRate) {
  function populatePair(matrix, to, from, shouldShareExp, shouldReply) {
    matrix[to][from] = shouldShareExp
      ? generateExperienceCharacteristics(to, from)
      : null;
    matrix[from][to] =
      shouldShareExp && shouldReply
        ? generateExperienceCharacteristics(from, to)
        : null;
  }

  function prePopulate(expMatrix) {
    const pt = profileType;

    const fromSameBatch = function differsOnlyLastDigit(x, y) {
      return Math.floor(x / 10) === Math.floor(y / 10);
    };

    for (let to = 0; to < expMatrix.length; to++) {
      for (let from = 0; from < expMatrix.length; from++) {
        if (
          fromSameBatch(from, to) &&
          ((pt.isWriter(from) && pt.isRecipient(to)) ||
            (pt.isReplier(from) && pt.isWriter(to)))
        ) {
          expMatrix[to][from] = generateExperienceCharacteristics(to, from);
        } else if (pt.isPrePopulated(to) || pt.isPrePopulated(from)) {
          expMatrix[to][from] = null;
        }
      }
    }
  }

  function populateOneProfileWithLotsOfExperiences(
    expMatrix,
    seqNum,
    replyRate,
  ) {
    for (let from = 0; from < expMatrix.length; from++) {
      if (seqNum !== from && !profileType.isPrePopulated(from)) {
        const shouldReply = Math.random() < replyRate;
        populatePair(expMatrix, seqNum, from, true, shouldReply);
      }
    }
  }

  function populateRandomly(expMatrix, averageExpNumber, replyRate) {
    function getExperienceSharingRate(nUsers, averageExpNumber, replyRate) {
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
    const expSharingRate = getExperienceSharingRate(
      expMatrix.length,
      averageExpNumber,
      replyRate,
    );
    for (let to = 1; to < expMatrix.length; to++) {
      for (let from = 0; from < to; from++) {
        if (
          !pt.isPrePopulated(to) &&
          !pt.isPrePopulated(from) &&
          to !== from &&
          pt.SEQNUM_WITH_MANY_EXPERIENCES !== to &&
          pt.SEQNUM_WITH_MANY_EXPERIENCES !== from
        ) {
          const shouldShareExperience = Math.random() < expSharingRate;
          const shouldReply = Math.random() < replyRate;
          populatePair(expMatrix, to, from, shouldShareExperience, shouldReply);
        }
      }
    }
  }

  const matrix = Array(nUsers)
    .fill()
    .map(() => Array(nUsers).fill());

  // cannot share experience with myself
  Array.from({ length: nUsers }, (x, i) => (matrix[i][i] = null));

  /*
   * To cover different cases, we first make sure there are profiles
   * with no experiences, one experience with and without reply,
   * profiles with only non-public experience.
   *
   * Then we populate one profile with as many experiences as we can.
   *
   * Then we populate the rest of the profiles randomly.
   */
  prePopulate(matrix);
  populateOneProfileWithLotsOfExperiences(
    matrix,
    profileType.SEQNUM_WITH_MANY_EXPERIENCES,
    replyRate,
  );
  populateRandomly(matrix, averageExpNumber, replyRate);
  return matrix;
}

function seedExperiences() {
  const debug = argv.debug === true;

  console.log(chalk.white('--'));
  console.log(chalk.green('Trustroots test experiences data'));
  console.log(chalk.white('--'));

  // Override debug mode to use the option set by the user
  config.db.debug = debug;

  mongooseService.connect(() => {
    mongooseService.loadModels(async () => {
      const Reference = mongoose.model('Reference');
      const User = mongoose.model('User');

      const users = await User.find().sort('username');

      function createExperience(userTo, userFrom, expSharing) {
        const experience = new Reference();
        experience.created = util.addDays(Date.now(), -_.random(14));
        experience.feedbackPublic = faker.lorem.sentences();
        experience.userTo = userTo;
        experience.userFrom = userFrom;
        experience.interactions = expSharing.interactions;
        experience.recommend = expSharing.recommend;
        experience.public = expSharing.public;
        return experience;
      }

      function saveExperiences(expMatrix) {
        return Promise.all(
          expMatrix.map((row, i) => {
            return Promise.all(
              row.map((elm, j) => {
                return new Promise((resolve, reject) => {
                  if (elm === null) {
                    resolve();
                    return;
                  }

                  const experience = createExperience(
                    users[i]._id,
                    users[j]._id,
                    elm,
                  );

                  experience.save(err => {
                    if (err != null) {
                      console.log(err);
                      reject();
                    } else {
                      process.stdout.write('.');
                      resolve();
                    }
                  });
                });
              }),
            );
          }),
        );
      }

      function countNonNullElements(matrix) {
        return matrix
          .map(row =>
            row.map(elm => (elm === null ? 0 : 1)).reduce((a, b) => a + b, 0),
          )
          .reduce((a, b) => a + b, 0);
      }

      if (users.length < profileType.minimumTestableUserNumber()) {
        console.error(
          chalk.red(
            `At least ${profileType.minimumTestableUserNumber()} users must exist in the db to test experiences. Please create more users and run again`,
          ),
        );
        mongooseService.disconnect();
        return;
      }

      const experience = await Reference.findOne();
      if (experience && !argv.force) {
        console.log(
          chalk.red(
            'Experiences already exist in the db. Use --force option if you want to rewrite them',
          ),
        );
      } else {
        if (experience) {
          console.log(
            chalk.yellow(
              'Running with --force option. Removing existing Experiences ...',
            ),
          );
          await Reference.deleteMany();
        }
        console.log(
          `Profile with many experiences (username): ${
            users[profileType.SEQNUM_WITH_MANY_EXPERIENCES].username
          }`,
        );

        try {
          const expCharacteristicsMatrix = generateExpCharacteristicMatrix(
            users.length,
            argv.averageExpNumber,
            argv.replyRate,
          );
          const nExperiencesToBeAdded = countNonNullElements(
            expCharacteristicsMatrix,
          );
          console.log(
            chalk.green(`Saving ${nExperiencesToBeAdded} experiences ... `),
          );
          await saveExperiences(expCharacteristicsMatrix);
        } catch (err) {
          console.log(err);
        }
      }
      mongooseService.disconnect();
    }); // monggooseService.loadModels
  }); // mongooseService.connect
}

seedExperiences();
