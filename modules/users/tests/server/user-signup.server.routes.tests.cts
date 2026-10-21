import type { CapturedJob } from '../../../../testutils/server/server.testutil.mts';
import type {
  UserModel,
  UserModelDocument,
  UserRecord,
} from '../../../../testutils/server/model-contracts.mts';
const should: typeof import('should') = require('should');
const mongoose: typeof import('mongoose') = require('mongoose');
interface ApiResponseBody {
  _id?: string;
  username?: string;
  email?: string;
  emailTemporary?: string;
  provider?: string;
  public?: boolean;
  created?: string;
  updated?: string;
  acquisitionStory?: string;
  emailToken?: string;
  password?: string;
  salt?: string;
  roles?: string[];
  message?: string;
  profileMadePublic?: boolean;
  user?: {
    email: string;
    username: string;
    public: boolean;
    emailTemporary: string;
    emailToken?: string;
    password?: string;
    salt?: string;
  };
}
interface TestResponse {
  body: ApiResponseBody;
  text: string;
  redirect: boolean;
}
interface TestRequest extends PromiseLike<TestResponse> {
  send(body: unknown): TestRequest;
  set(name: string, value: string): TestRequest;
  expect(status: number | string, expected?: string | RegExp): TestRequest;
  end(callback: (error: Error | null, response: TestResponse) => void): void;
}
interface TestAgent {
  get(path: string): TestRequest;
  post(path: string): TestRequest;
}
const request: {
  agent(app: unknown): TestAgent;
} = require('supertest');
const express: typeof import('../../../../config/lib/express.mjs').default = require('./../../../../config/lib/express.mjs');
const testutils: typeof import('../../../../testutils/server/server.testutil.mts') = require('../../../../testutils/server/server.testutil');
const dataUtils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil');
type UserDocument = UserModelDocument;
const User = mongoose.model<UserRecord, UserModel>('User');
/**
 * Globals
 */
let app: Awaited<ReturnType<typeof express.init>>;
let agent: ReturnType<typeof request.agent>;
let confirmedCredentials: {
  username: string;
  password: string;
};
let confirmedUser: UserDocument;
let _confirmedUser: Partial<UserRecord> &
  Pick<
    UserRecord,
    'firstName' | 'lastName' | 'email' | 'username' | 'password' | 'provider'
  >;
let unConfirmedCredentials: {
  username: string;
  password: string;
};
let unConfirmedUser: UserDocument;
let _unConfirmedUser: Partial<UserRecord> &
  Pick<
    UserRecord,
    'firstName' | 'lastName' | 'email' | 'username' | 'password' | 'provider'
  >;
interface EmailJobData {
  subject: string;
  text: string;
  to: {
    address: string;
  };
}
function emailJobData(job: CapturedJob): EmailJobData {
  const { data } = job;
  if (
    typeof data !== 'object' ||
    data === null ||
    !('subject' in data) ||
    typeof data.subject !== 'string' ||
    !('text' in data) ||
    typeof data.text !== 'string' ||
    !('to' in data) ||
    typeof data.to !== 'object' ||
    data.to === null ||
    !('address' in data.to) ||
    typeof data.to.address !== 'string'
  ) {
    throw new Error('Expected a captured email job');
  }
  return {
    subject: data.subject,
    text: data.text,
    to: { address: data.to.address },
  };
}
function assertPresent<T>(value: T | null | undefined): asserts value is T {
  should.exist(value);
  if (value === null || value === undefined) {
    throw new Error('Expected a value to be present');
  }
}
function present<T>(value: T | null | undefined): T {
  assertPresent(value);
  return value;
}
/**
 * User routes tests
 */
describe('User signup and authentication CRUD tests', function () {
  const jobs = testutils.catchJobs();
  const emails = testutils.catchEmails();
  before(function (done) {
    (async () => {
      // Get application
      app = await express.init(mongoose.connection);
      agent = request.agent(app);
      done();
    })().catch(done);
  });
  // Create an user
  beforeEach(function (done) {
    // Create user credentials
    confirmedCredentials = {
      username: 'TRusername',
      password: 'TR-I$Aw3$0m4',
    };
    // Create a new user
    _confirmedUser = {
      public: true,
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test@example.org',
      emailToken: 'initial email token',
      username: confirmedCredentials.username.toLowerCase(),
      password: confirmedCredentials.password,
      provider: 'local',
    };
    confirmedUser = new User(_confirmedUser);
    // Save a user to the test db
    confirmedUser
      .save()
      .then(() => done())
      .catch(done);
  });
  // Create an unconfirmed user
  beforeEach(function (done) {
    unConfirmedCredentials = {
      username: 'TRusernameunconfirmed',
      password: 'TR-I$Aw3$0m4',
    };
    _unConfirmedUser = {
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'unconfirmed-test@example.org',
      emailTemporary: 'unconfirmed-test@example.org',
      // unconfirmed users have this set
      emailToken: 'initial email token',
      username: unConfirmedCredentials.username.toLowerCase(),
      password: unConfirmedCredentials.password,
      provider: 'local',
      acquisitionStory: 'A fish told me...',
    };
    unConfirmedUser = new User(_unConfirmedUser);
    // Save a user to the test db
    unConfirmedUser
      .save()
      .then(() => done())
      .catch(done);
  });
  afterEach(dataUtils.clearDatabase);
  for (const ageConfirmed of [
    undefined,
    false,
    null,
    'true',
    1,
    [],
    {},
    ['true'],
  ]) {
    it(
      'rejects unconfirmed adult status: ' + JSON.stringify(ageConfirmed),
      async function () {
        const response = await agent
          .post('/api/auth/signup')
          .send({
            firstName: 'Amina',
            lastName: 'Vale',
            username: 'adultmember',
            email: 'adult-member@example.test',
            password: 'Password123!',
            ageConfirmed,
          })
          .expect(400);
        present(response.body.message).should.equal(
          'You must confirm that you are 18 years old or older to sign up.',
        );
        should.not.exist(await User.findOne({ username: 'adultmember' }));
        emails.should.have.length(0);
        jobs.length.should.equal(0);
      },
    );
  }

  it('explains underscore rejection without creating an account', async function () {
    const response = await agent
      .post('/api/auth/signup')
      .send({
        ageConfirmed: true,
        firstName: 'Amina',
        lastName: 'Vale',
        username: 'sample_member',
        email: 'sample-member@example.org',
        password: 'password123',
      })
      .expect(400);
    present(response.body.message).should.equal(
      'Use 3–34 letters and numbers, including at least one letter.',
    );
    should.not.exist(
      await User.findOne({
        username: 'sample_member',
      }),
    );
  });
  for (const username of ['SampleMember', 'samplemember1']) {
    it('preserves signup support for ' + username, async function () {
      const response = await agent
        .post('/api/auth/signup')
        .send({
          ageConfirmed: true,
          firstName: 'Amina',
          lastName: 'Vale',
          username,
          email: 'sample-member@example.org',
          password: 'password123',
        })
        .expect(200);
      present(response.body.username).should.equal(username.toLowerCase());
    });
  }
  it('initialises only the supported signup fields', async function () {
    const payload = {
      firstName: 'Sample',
      lastName: 'Member',
      username: 'payloadmember',
      password: 'ExamplePassword123!',
      email: 'payload-member@example.test',
      newsletter: true,
      acquisitionStory: 'A fictional invitation',
      locale: 'en',
      authVersion: 99,
      roles: ['admin'],
      avatarVersion: 'unexpected-avatar',
      avatarUploaded: true,
      blocked: ['000000000000000000000001'],
      additionalProvidersData: { github: { id: 'unexpected-provider' } },
      resetPasswordToken: 'unexpected-token',
    };
    const response = await agent
      .post('/api/auth/signup')
      .send({ ...payload, ageConfirmed: true })
      .expect(200);
    const stored = await User.findOne({ username: payload.username });
    assertPresent(stored);
    present(stored.authVersion).should.equal(0);
    present(stored.roles).should.deepEqual(['user']);
    present(stored.newsletter).should.equal(true);
    Object.hasOwn(stored.toObject(), 'ageConfirmed').should.be.false();
    Object.hasOwn(response.body, 'ageConfirmed').should.be.false();
    present(stored.locale).should.equal('en');
    present(stored.acquisitionStory).should.equal(payload.acquisitionStory);
    present(stored.avatarUploaded).should.equal(false);
    present(stored.blocked).should.have.length(0);
    should.not.exist(stored.avatarVersion);
    should.not.exist(stored.resetPasswordToken);
    should.not.exist(stored.additionalProvidersData?.github);
    present(response.body.username).should.equal(payload.username);
  });
  it('rejects structured required fields and malformed signup preferences', async function () {
    const payload = {
      firstName: 'Sample',
      lastName: 'Member',
      username: 'typedmember',
      password: 'ExamplePassword123!',
      email: 'typed-member@example.test',
    };
    for (const field of [
      'firstName',
      'lastName',
      'username',
      'password',
      'email',
    ]) {
      const response = await agent
        .post('/api/auth/signup')
        .send({ ...payload, ageConfirmed: true, [field]: { value: null } })
        .expect(400);
      present(response.body.message).should.equal(
        'Please provide required fields.',
      );
    }
    for (const field of ['locale', 'acquisitionStory', 'newsletter']) {
      const response = await agent
        .post('/api/auth/signup')
        .send({ ...payload, ageConfirmed: true, [field]: { value: null } })
        .expect(400);
      present(response.body.message).should.equal(
        'Please provide valid signup preferences.',
      );
    }
    should.not.exist(await User.findOne({ username: payload.username }));
  });
  it('should be able to register a new user', function (done) {
    _unConfirmedUser.username = 'RegisterNewUser';
    _unConfirmedUser.email = 'register-new-user@example.org';
    agent
      .post('/api/auth/signup')
      .send({
        ..._unConfirmedUser,
        ageConfirmed: true,
      })
      .expect(200)
      .end(function (signupErr, signupRes) {
        // Handle signup error
        if (signupErr) {
          return done(signupErr);
        }
        present(signupRes.body.username).should.equal(
          _unConfirmedUser.username.toLowerCase(),
        );
        present(signupRes.body.username).should.not.equal(
          _unConfirmedUser.username,
        );
        present(signupRes.body.email).should.equal(_unConfirmedUser.email);
        present(signupRes.body.emailTemporary).should.equal(
          _unConfirmedUser.email,
        );
        present(signupRes.body.provider).should.equal('local');
        present(signupRes.body.public).should.equal(false);
        present(signupRes.body.created).should.not.be.empty();
        should.not.exist(signupRes.body.acquisitionStory);
        should.not.exist(signupRes.body.updated);
        // Sensitive information should be not sent to the client
        should.not.exist(signupRes.body.emailToken);
        should.not.exist(signupRes.body.password);
        should.not.exist(signupRes.body.salt);
        should.not.exist(signupRes.body.roles);
        jobs.length.should.equal(1);
        jobs[0].type.should.equal('send email');
        emailJobData(jobs[0]).subject.should.equal('Confirm Email');
        emailJobData(jobs[0]).to.address.should.equal(_unConfirmedUser.email);
        User.findById(present(signupRes.body._id))
          .then((savedUser: UserDocument | null) => {
            assertPresent(savedUser);
            present(savedUser.acquisitionStory).should.equal(
              _unConfirmedUser.acquisitionStory,
            );
            done();
          })
          .catch(done);
      });
  });
  it('should be able to register a new user but not inject additional roles', function (done) {
    _unConfirmedUser.username = 'RegisterNewUser';
    _unConfirmedUser.email = 'register-new-user@example.org';
    _unConfirmedUser.roles = ['user', 'admin'];
    agent
      .post('/api/auth/signup')
      .send({
        ..._unConfirmedUser,
        ageConfirmed: true,
      })
      .expect(200)
      .end(function (err, signupRes) {
        should.not.exist(err);
        should.not.exist(signupRes.body.roles);
        User.findById(present(signupRes.body._id))
          .then((userFindRes: UserDocument | null) => {
            should.not.exist(null);
            assertPresent(userFindRes);
            present(userFindRes.roles)
              .should.be.instanceof(Array)
              .and.have.lengthOf(1);
            present(userFindRes.roles).indexOf('user').should.equal(0);
            done();
          })
          .catch(done);
      });
  });
  it('should be able to register a new user and confirm email with token and user should become public', function (done) {
    _unConfirmedUser.username = 'RegisterNewUser';
    _unConfirmedUser.email = 'register-new-user@example.org';
    agent
      .post('/api/auth/signup')
      .send({
        ..._unConfirmedUser,
        ageConfirmed: true,
      })
      .expect(200)
      .end(function (signupErr, signupRes) {
        // Handle signup error
        if (signupErr) {
          return done(signupErr);
        }
        present(signupRes.body.public).should.equal(false);
        should.not.exist(signupRes.body.emailToken);
        should.not.exist(signupRes.body.password);
        should.not.exist(signupRes.body.salt);
        present(signupRes.body.emailTemporary).should.equal(
          _unConfirmedUser.email,
        );
        jobs.length.should.equal(1);
        jobs[0].type.should.equal('send email');
        emailJobData(jobs[0]).subject.should.equal('Confirm Email');
        emailJobData(jobs[0]).to.address.should.equal(_unConfirmedUser.email);
        User.findOne({
          username: _unConfirmedUser.username.toLowerCase(),
        })
          .then((userRes1: UserDocument | null) => {
            assertPresent(userRes1);
            present(userRes1.public).should.equal(false);
            userRes1.email.should.not.be.empty();
            present(userRes1.emailToken).should.not.be.empty();
            present(userRes1.emailToken).should.startWith('sha256:');
            const tokenMatch = emailJobData(jobs[0]).text.match(
              /\/confirm-email\/([a-f0-9]+)/,
            );
            if (!tokenMatch) throw new Error('Expected a confirmation token');
            const rawToken = tokenMatch[1];
            userRes1.emailToken = rawToken;
            // GET should give us redirect
            agent
              .get('/api/auth/confirm-email/' + userRes1.emailToken)
              .expect(302)
              .end(function (confirmEmailPostErr, confirmEmailGetRes) {
                if (confirmEmailPostErr) {
                  return done(confirmEmailPostErr);
                }
                confirmEmailGetRes.text.should.equal(
                  'Found. Redirecting to /confirm-email/' + userRes1.emailToken,
                );
                // POST does the actual job
                agent
                  .post('/api/auth/confirm-email/' + userRes1.emailToken)
                  .set('X-Trustroots-Request', '1')
                  .expect(200)
                  .end(function (confirmEmailPostErr, confirmEmailPostRes) {
                    if (confirmEmailPostErr) {
                      return done(confirmEmailPostErr);
                    }
                    jobs.length.should.equal(1);
                    jobs[0].type.should.equal('send email');
                    // User should now be public
                    present(
                      confirmEmailPostRes.body.profileMadePublic,
                    ).should.equal(true);
                    const responseUser = present(confirmEmailPostRes.body.user);
                    present(responseUser.public).should.equal(true);
                    present(responseUser.emailTemporary).should.be.empty();
                    // Sensitive information should be not sent to the client
                    should.not.exist(responseUser.emailToken);
                    should.not.exist(responseUser.password);
                    should.not.exist(responseUser.salt);
                    return done();
                  });
              });
          })
          .catch(done);
      });
  });
  it('should be able to register a new user and confirming email with wrong token should redirect error and yeld an error and user should not be public', function (done) {
    _unConfirmedUser.username = 'RegisterNewUser';
    _unConfirmedUser.email = 'register-new-user@example.org';
    agent
      .post('/api/auth/signup')
      .send({
        ..._unConfirmedUser,
        ageConfirmed: true,
      })
      .expect(200)
      .end(function (signupErr, signupRes) {
        // Handle signup error
        if (signupErr) {
          return done(signupErr);
        }
        present(signupRes.body.public).should.equal(false);
        should.not.exist(signupRes.body.emailToken);
        should.not.exist(signupRes.body.password);
        should.not.exist(signupRes.body.salt);
        present(signupRes.body.emailTemporary).should.equal(
          _unConfirmedUser.email,
        );
        User.findOne({
          username: _unConfirmedUser.username.toLowerCase(),
        })
          .then((userRes1: UserDocument | null) => {
            assertPresent(userRes1);
            present(userRes1.public).should.equal(false);
            userRes1.email.should.not.be.empty();
            present(userRes1.emailToken).should.not.be.empty();
            // GET should give us redirect
            agent
              .get('/api/auth/confirm-email/WRONG_TOKEN')
              .expect(302)
              .end(function (confirmEmailPostErr, confirmEmailGetRes) {
                if (confirmEmailPostErr) {
                  return done(confirmEmailPostErr);
                }
                confirmEmailGetRes.text.should.equal(
                  'Found. Redirecting to /confirm-email-invalid',
                );
                // POST does the actual job
                agent
                  .post('/api/auth/confirm-email/WRONG_TOKEN')
                  .set('X-Trustroots-Request', '1')
                  .expect(400)
                  .end(function (confirmEmailPostErr, confirmEmailPostRes) {
                    if (confirmEmailPostErr) {
                      return done(confirmEmailPostErr);
                    }
                    present(confirmEmailPostRes.body.message).should.equal(
                      'Email confirm token is invalid or has expired.',
                    );
                    return done();
                  });
              });
          })
          .catch(done);
      });
  });
  it('should be able to login successfully using username and logout successfully', function (done) {
    agent
      .post('/api/auth/signin')
      .send(confirmedCredentials)
      .expect(200)
      .end(function (signinErr, signinRes) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }
        // Sensitive information should be not sent to the client
        should.not.exist(signinRes.body.emailToken);
        should.not.exist(signinRes.body.password);
        should.not.exist(signinRes.body.salt);
        // Logout
        agent
          .post('/api/auth/signout')
          .set('Origin', 'http://localhost:3000')
          .expect(302)
          .end(function (signoutErr, signoutRes) {
            if (signoutErr) {
              return done(signoutErr);
            }
            signoutRes.redirect.should.equal(true);
            signoutRes.text.should.equal('Found. Redirecting to /');
            return done();
          });
      });
  });
  it('should be able to login successfully using email and logout successfully', function (done) {
    agent
      .post('/api/auth/signin')
      .send({
        username: 'test@example.org',
        password: confirmedCredentials.password,
      })
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }
        // Logout
        agent
          .post('/api/auth/signout')
          .set('Origin', 'http://localhost:3000')
          .expect(302)
          .end(function (signoutErr, signoutRes) {
            if (signoutErr) {
              return done(signoutErr);
            }
            signoutRes.redirect.should.equal(true);
            signoutRes.text.should.equal('Found. Redirecting to /');
            return done();
          });
      });
  });
  it('should reject signin with an unknown username', function (done) {
    agent
      .post('/api/auth/signin')
      .send({
        username: 'nobody-here',
        password: confirmedCredentials.password,
      })
      .expect(400)
      .end(function (signinErr, signinRes) {
        if (signinErr) {
          return done(signinErr);
        }
        present(signinRes.body.message).should.equal(
          'Unknown user or invalid password',
        );
        done();
      });
  });
  it('should reject signin with an invalid password', function (done) {
    agent
      .post('/api/auth/signin')
      .send({
        username: confirmedCredentials.username,
        password: 'definitely-not-the-password',
      })
      .expect(400)
      .end(function (signinErr, signinRes) {
        if (signinErr) {
          return done(signinErr);
        }
        present(signinRes.body.message).should.equal(
          'Unknown user or invalid password',
        );
        done();
      });
  });
  it('should not be able to login successfully if user has "suspended" role', function (done) {
    confirmedUser.roles = ['user', 'suspended'];
    confirmedUser
      .save()
      .then(() => {
        should.not.exist(null);
        agent
          .post('/api/auth/signin')
          .send(confirmedCredentials)
          .expect(403)
          .end(function (signinErr, signinRes) {
            // Handle signin error
            if (signinErr) {
              return done(signinErr);
            }
            present(signinRes.body.message).should.equal(
              'Your account has been suspended.',
            );
            return done();
          });
      })
      .catch(done);
  });
  it('should invalidate sessions of authenticated user with "suspended" role and return error for json requests', function (done) {
    agent
      .post('/api/auth/signin')
      .send(confirmedCredentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }
        // Suspend user
        confirmedUser.roles = ['user', 'suspended'];
        confirmedUser
          .save()
          .then(() => {
            // Load some json from API, get 403 suspended error
            agent
              .get('/api/users/' + confirmedUser.username)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(403)
              .end(function (err, res) {
                // Handle error
                if (err) {
                  return done(err);
                }
                present(res.body.message).should.equal(
                  'Your account has been suspended.',
                );
                // Load some json from API again,
                // get normal 403 forbidden error since session is now destroyed
                agent
                  .get('/api/users/' + confirmedUser.username)
                  .expect(403)
                  .end(function (err, res) {
                    // Handle error
                    if (err) {
                      return done(err);
                    }
                    present(res.body.message).should.equal('Forbidden.');
                    return done();
                  });
              });
          })
          .catch(done);
      });
  });
  it('should invalidate sessions of authenticated user with "suspended" role and return error page for text/html requests', function (done) {
    agent
      .post('/api/auth/signin')
      .send(confirmedCredentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }
        // Suspend user
        confirmedUser.roles = ['user', 'suspended'];
        confirmedUser
          .save()
          .then(() => {
            // Load html page
            agent
              .get('/')
              .set('Accept', 'text/html')
              .expect('Content-Type', 'text/html; charset=utf-8')
              .expect(403)
              .end(function (err, res) {
                // Handle error
                if (err) {
                  return done(err);
                }
                // Note how we check for `res.text` instead of `res.body`
                res.text.should.containEql('Your account has been suspended.');
                // Load some html again,
                // get normal 200 since session is now destroyed
                agent
                  .get('/')
                  .set('Accept', 'text/html')
                  .expect(200)
                  .end(function (err) {
                    // Handle error
                    if (err) {
                      return done(err);
                    }
                    return done();
                  });
              });
          })
          .catch(done);
      });
  });
  context('logged in as a confirmed user', function () {
    beforeEach(function (done) {
      agent
        .post('/api/auth/signin')
        .send(confirmedCredentials)
        .expect(200)
        .end(function (err, signinRes) {
          if (err) return done(err);
          // Sanity check they are confirmed
          present(signinRes.body.public).should.equal(true);
          done();
        });
    });
    it('should not resend confirmation token', function (done) {
      agent
        .post('/api/auth/resend-confirmation')
        .set('X-Trustroots-Request', '1')
        .expect(400)
        .end(function (err, resendRes) {
          if (err) return done(err);
          present(resendRes.body.message).should.equal('Already confirmed.');
          done();
        });
    });
    context('with changed email address', function () {
      beforeEach(function (done) {
        confirmedUser.emailTemporary = 'confirmed-test-changed@example.org';
        confirmedUser
          .save()
          .then(() => done())
          .catch(done);
      });
      it('should resend confirmation token for email change', function (done) {
        agent
          .post('/api/auth/resend-confirmation')
          .set('X-Trustroots-Request', '1')
          .expect(200)
          .end(function (err, resendRes) {
            if (err) return done(err);
            present(resendRes.body.message).should.equal(
              'Sent confirmation email.',
            );
            jobs.length.should.equal(1);
            jobs[0].type.should.equal('send email');
            emailJobData(jobs[0]).subject.should.equal('Confirm email change');
            emailJobData(jobs[0]).to.address.should.equal(
              'confirmed-test-changed@example.org',
            );
            done();
          });
      });
    });
  });
  context('logged in as un-confirmed user', function () {
    beforeEach(function (done) {
      agent
        .post('/api/auth/signin')
        .send(unConfirmedCredentials)
        .expect(200)
        .end(function (err, signinRes) {
          if (err) return done(err);
          // Sanity check they are unconfirmed
          present(signinRes.body.public).should.equal(false);
          done();
        });
    });
    it('should resend confirmation token', function (done) {
      agent
        .post('/api/auth/resend-confirmation')
        .set('X-Trustroots-Request', '1')
        .expect(200)
        .end(function (err, resendRes) {
          if (err) return done(err);
          present(resendRes.body.message).should.equal(
            'Sent confirmation email.',
          );
          User.findOne(
            {
              username: _unConfirmedUser.username.toLowerCase(),
            },
            'emailToken',
          )
            .then((userRes: UserDocument | null) => {
              assertPresent(userRes);
              assertPresent(userRes.emailToken);
              // Make sure it has changed from the original value
              userRes.emailToken.should.not.equal(_unConfirmedUser.emailToken);
              jobs.length.should.equal(1);
              jobs[0].type.should.equal('send email');
              emailJobData(jobs[0]).subject.should.equal('Confirm Email');
              emailJobData(jobs[0]).to.address.should.equal(
                _unConfirmedUser.emailTemporary,
              );
              done();
            })
            .catch(done);
        });
    });
  });
});
