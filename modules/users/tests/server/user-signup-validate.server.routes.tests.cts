import type {
  UserModel,
  UserRecord,
} from '../../../../testutils/server/model-contracts.mts';
const should: typeof import('should') = require('should');
const request: typeof import('supertest') = require('supertest');
const mongoose: typeof import('mongoose') = require('mongoose');
const express: typeof import('../../../../config/lib/express.mjs').default = require('./../../../../config/lib/express.mjs');
const config: typeof import('../../../../config/config.mts').default & {
  illegalStrings: string[];
} = require('./../../../../config/config.mts');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil');
const User = mongoose.model<UserRecord, UserModel>('User');
/**
 * Globals
 */
let app: Awaited<ReturnType<typeof express.init>>;
let agent: ReturnType<typeof request.agent>;
let user:
  | import('../../../../testutils/server/model-contracts.mts').UserModelDocument
  | undefined;
interface ValidationInput {
  username?: unknown;
}
interface ValidationResult {
  body: {
    valid: boolean;
    error?: string;
    message?: string;
  };
}
function validationFailure(
  object: ValidationInput,
  error: string,
  message: string,
  done: Mocha.Done,
): void {
  agent
    .post('/api/auth/signup/validate')
    .send(object)
    .expect(200)
    .end(function (validateErr: Error | null, validateRes: ValidationResult) {
      // Handle error
      if (validateErr) {
        return done(validateErr);
      }
      validateRes.body.valid.should.be.false();
      should(validateRes.body.error).equal(error);
      should(validateRes.body.message).equal(message);
      done();
    });
}
function validationSuccess(object: ValidationInput, done: Mocha.Done): void {
  agent
    .post('/api/auth/signup/validate')
    .send(object)
    .expect(200)
    .end(function (validateErr: Error | null, validateRes: ValidationResult) {
      // Handle error
      if (validateErr) {
        return done(validateErr);
      }
      validateRes.body.valid.should.be.true();
      should.not.exist(validateRes.body.error);
      should.not.exist(validateRes.body.message);
      done();
    });
}
/**
 * User routes tests
 */
describe('User signup validation CRUD tests', function () {
  before(function (done) {
    (async () => {
      // Get application
      app = await express.init(mongoose.connection);
      agent = request.agent(app);
      done();
    })().catch(done);
  });
  afterEach(utils.clearDatabase);
  describe('Username validation', function () {
    it('should show an error when missing username info', function (done) {
      validationFailure(
        {},
        'username-missing',
        'Please provide required `username` field.',
        done,
      );
    });
    it('should show an error when validating taken username', function (done) {
      // Create an user
      user = new User({
        public: true,
        firstName: 'Full',
        lastName: 'Name',
        displayName: 'Full Name',
        email: 'test@example.org',
        emailToken: 'initial email token',
        username: 'takenusername',
        password: 'TR-I$Aw3$0m4',
        provider: 'local',
      });
      user
        .save()
        .then(function () {
          validationFailure(
            {
              username: 'takenusername',
            },
            'username-not-available',
            'Username is not available.',
            done,
          );
        })
        .catch(done);
    });
    it('should validate taken username case-insensitively', function (done) {
      user = new User({
        public: true,
        firstName: 'Full',
        lastName: 'Name',
        displayName: 'Full Name',
        email: 'case@example.org',
        emailToken: 'initial email token',
        username: 'takencaseusername',
        password: 'TR-I$Aw3$0m4',
        provider: 'local',
      });
      user
        .save()
        .then(function () {
          validationFailure(
            {
              username: 'TAKENCASEUSERNAME',
            },
            'username-not-available',
            'Username is not available.',
            done,
          );
        })
        .catch(done);
    });
    it('should show an error when try to validate with not allowed username', function (done) {
      validationFailure(
        {
          username:
            config.illegalStrings[
              Math.floor(Math.random() * config.illegalStrings.length)
            ],
        },
        'username-not-available-reserved',
        'Username is not available.',
        done,
      );
    });
    describe('Username is in invalid format', function () {
      const invalidMessage =
        'Use 3–34 letters and numbers, including at least one letter.';
      it('should show error to validate username beginning with "." (dot)', function (done) {
        validationFailure(
          {
            username: '.login',
          },
          'username-invalid',
          invalidMessage,
          done,
        );
      });
      it('should show error to validate username end with "." (dot)', function (done) {
        validationFailure(
          {
            username: 'login.',
          },
          'username-invalid',
          invalidMessage,
          done,
        );
      });
      it('should show error to validate username with ..', function (done) {
        validationFailure(
          {
            username: 'log..in',
          },
          'username-invalid',
          invalidMessage,
          done,
        );
      });
      it('should show error to validate username shorter than 3 character', function (done) {
        validationFailure(
          {
            username: 'lo',
          },
          'username-invalid',
          invalidMessage,
          done,
        );
      });
      it('should show error validating a username without at least one alphanumeric character', function (done) {
        validationFailure(
          {
            username: '-_-',
          },
          'username-invalid',
          invalidMessage,
          done,
        );
      });
      it('should show error validating a username longer than 34 characters', function (done) {
        validationFailure(
          {
            username: 'l'.repeat(35),
          },
          'username-invalid',
          invalidMessage,
          done,
        );
      });
    });
    describe('Username is valid', function () {
      it('should validate an uppercase username with digits', function (done) {
        validationSuccess(
          {
            username: 'Member42',
          },
          done,
        );
      });
    });
  });
});
