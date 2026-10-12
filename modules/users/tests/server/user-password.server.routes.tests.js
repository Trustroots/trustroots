const should = require('should');
const request = require('supertest');
const mongoose = require('mongoose');
const express = require('./../../../../config/lib/express.mjs');
const utils = require('../../../../testutils/server/data.server.testutil');
const User = mongoose.model('User');

/**
 * Globals
 */
let app;
let agent;
let credentials;
let user;
let _user;

async function findUserWithResetToken(query) {
  const timeout = Date.now() + 3000;
  for (;;) {
    const foundUser = await User.findOne(query);
    if (foundUser && foundUser.resetPasswordToken) {
      return foundUser;
    }
    if (Date.now() >= timeout) {
      throw new Error('Password recovery token was not saved.');
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

/**
 * User routes tests
 */
describe('User password CRUD tests', function () {
  before(function (done) {
    (async () => {
      // Get application
      app = await express.init(mongoose.connection);
      agent = request.agent(app);
      done();
    })().catch(done);
  });

  // Create an user

  beforeEach(async function () {
    // Create user credentials
    credentials = {
      username: 'TR_username',
      password: 'TR-I$Aw3$0m4',
    };

    // Create a new user
    _user = {
      public: true,
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test@example.org',
      emailToken: 'initial email token',
      username: credentials.username.toLowerCase(),
      password: credentials.password,
      provider: 'local',
    };
    user = new User(_user);

    // Save a user to the test db
    await user.save();
  });
  afterEach(utils.clearDatabase);

  it('rejects structured and oversized recovery identifiers', async function () {
    for (const username of [
      { $ne: null },
      ['sample-member'],
      12,
      'a'.repeat(321),
    ]) {
      await agent.post('/api/auth/forgot').send({ username }).expect(400);
    }
    const stored = await User.findById(user._id);
    should.not.exist(stored.resetPasswordToken);
  });

  it('forgot password acknowledges non-existent usernames consistently', async function () {
    user.roles = ['user'];
    await user.save();
    const res = await agent
      .post('/api/auth/forgot')
      .send({ username: 'some_username_that_doesnt_exist' })
      .expect(200);
    res.body.message.should.equal(
      'If an account matches that username or email, we will send recovery instructions.',
    );
  });
  it('forgot password should return 400 for no username provided', async function () {
    user.provider = 'facebook';
    user.roles = ['user'];
    await user.save();
    const res = await agent
      .post('/api/auth/forgot')
      .send({ username: '' })
      .expect(400);
    res.body.message.should.equal(
      'Please, we really need your username or email first...',
    );
  });
  it('forgot password should be able to reset password for user password reset request using username', async function () {
    user.roles = ['user'];
    await user.save();
    const res = await agent
      .post('/api/auth/forgot')
      .send({ username: user.username })
      .expect(200);
    res.body.message.should.be.equal(
      'If an account matches that username or email, we will send recovery instructions.',
    );

    const userRes = await findUserWithResetToken({
      username: user.username.toLowerCase(),
    });
    userRes.resetPasswordToken.should.not.be.empty();
    should.exist(userRes.resetPasswordExpires);
  });
  it('forgot password should be able to reset password for user password reset request using uppercase username', async function () {
    user.roles = ['user'];
    await user.save();
    const res = await agent
      .post('/api/auth/forgot')
      .send({ username: user.username.toUpperCase() })
      .expect(200);
    res.body.message.should.be.equal(
      'If an account matches that username or email, we will send recovery instructions.',
    );

    const userRes = await findUserWithResetToken({
      username: user.username.toLowerCase(),
    });
    userRes.resetPasswordToken.should.not.be.empty();
    should.exist(userRes.resetPasswordExpires);
  });
  it('forgot password should be able to reset password for user password reset request using email', async function () {
    user.roles = ['user'];
    await user.save();
    const res = await agent
      .post('/api/auth/forgot')
      .send({ username: user.email })
      .expect(200);
    res.body.message.should.be.equal(
      'If an account matches that username or email, we will send recovery instructions.',
    );

    const userRes = await findUserWithResetToken({
      email: user.email.toLowerCase(),
    });
    userRes.resetPasswordToken.should.not.be.empty();
    should.exist(userRes.resetPasswordExpires);
  });
  it('forgot password should be able to reset password for user password reset request using uppercase email', async function () {
    user.roles = ['user'];
    await user.save();
    const res = await agent
      .post('/api/auth/forgot')
      .send({ username: user.email.toUpperCase() })
      .expect(200);
    res.body.message.should.be.equal(
      'If an account matches that username or email, we will send recovery instructions.',
    );

    const userRes = await findUserWithResetToken({
      email: user.email.toLowerCase(),
    });
    userRes.resetPasswordToken.should.not.be.empty();
    should.exist(userRes.resetPasswordExpires);
  });
  it('forgot password should be able to reset the password using reset token', async function () {
    user.roles = ['user'];
    await user.save();
    await agent
      .post('/api/auth/forgot')
      .send({ username: user.username })
      .expect(200);

    const userRes = await findUserWithResetToken({
      username: user.username.toLowerCase(),
    });
    userRes.resetPasswordToken.should.not.be.empty();
    should.exist(userRes.resetPasswordExpires);
    const res = await agent
      .get('/api/auth/reset/' + userRes.resetPasswordToken)
      .expect(302);
    res.headers.location.should.be.equal(
      '/password/reset/' + userRes.resetPasswordToken,
    );
  });
  it('forgot password should return error when using invalid reset token', async function () {
    user.roles = ['user'];
    await user.save();
    await agent
      .post('/api/auth/forgot')
      .send({ username: user.username })
      .expect(200);
    const invalidToken = 'someTOKEN1234567890';
    const res = await agent.get('/api/auth/reset/' + invalidToken).expect(302);
    res.headers.location.should.be.equal('/password/reset/invalid');
  });
  it('forgot password should re-apply UTM parameters to the reset redirect', async function () {
    user.roles = ['user'];
    await user.save();
    await agent
      .post('/api/auth/forgot')
      .send({ username: user.username })
      .expect(200);

    const userRes = await findUserWithResetToken({
      username: user.username.toLowerCase(),
    });
    const res = await agent
      .get(
        '/api/auth/reset/' +
          userRes.resetPasswordToken +
          '?utm_source=transactional_email&utm_medium=email&utm_campaign=reset',
      )
      .expect(302);
    res.headers.location.should.containEql(
      '/password/reset/' + userRes.resetPasswordToken,
    );
    res.headers.location.should.containEql('utm_source=transactional_email');
  });
  it('should be able to reset the password with a valid token and matching passwords', async function () {
    user.roles = ['user'];
    await user.save();
    await agent
      .post('/api/auth/forgot')
      .send({ username: user.username })
      .expect(200);

    const userRes = await findUserWithResetToken({
      username: user.username.toLowerCase(),
    });
    const res = await agent
      .post('/api/auth/reset/' + userRes.resetPasswordToken)
      .send({
        newPassword: '1234567890Aa$',
        verifyPassword: '1234567890Aa$',
      })
      .expect(200);
    res.body.username.should.equal(user.username.toLowerCase());

    const updated = await User.findOne({
      username: user.username.toLowerCase(),
    });
    should.not.exist(updated.resetPasswordToken);
    should.not.exist(updated.resetPasswordExpires);
  });
  it('should not be able to reset the password if passwords do not match', async function () {
    user.roles = ['user'];
    await user.save();
    await agent
      .post('/api/auth/forgot')
      .send({ username: user.username })
      .expect(200);
    const userRes = await User.findOne({
      username: user.username.toLowerCase(),
    });
    const res = await agent
      .post('/api/auth/reset/' + userRes.resetPasswordToken)
      .send({
        newPassword: '1234567890Aa$',
        verifyPassword: 'something-else-Aa$1',
      })
      .expect(400);
    res.body.message.should.equal('Passwords do not match.');
  });
  it('should not be able to reset the password with an invalid token', async function () {
    const res = await agent
      .post('/api/auth/reset/someInvalidToken1234567890')
      .send({
        newPassword: '1234567890Aa$',
        verifyPassword: '1234567890Aa$',
      })
      .expect(400);
    res.body.message.should.equal(
      'Password reset token is invalid or has expired.',
    );
  });
  it('should be able to change password successfully', async function () {
    await agent.post('/api/auth/signin').send(credentials).expect(200);
    const res = await agent
      .post('/api/users/password')
      .send({
        newPassword: '1234567890Aa$',
        verifyPassword: '1234567890Aa$',
        currentPassword: credentials.password,
      })
      .expect(200);
    res.body.message.should.equal('Password changed successfully!');
    res.body.user.username.should.equal(user.username);
    res.body.user.email.should.equal(user.email);
    for (const field of [
      'password',
      'salt',
      'emailToken',
      'resetPasswordToken',
      'removeProfileToken',
      'providerData',
      'pushRegistration',
      'lastIpAddress',
    ]) {
      should.not.exist(res.body.user[field]);
    }
  });

  it('requires the current password when changing credentials', async function () {
    await agent.post('/api/auth/signin').send(credentials).expect(200);
    const response = await agent
      .post('/api/users/password')
      .send({ newPassword: 'ExampleNew123!', verifyPassword: 'ExampleNew123!' })
      .expect(400);
    response.body.message.should.equal('Current password is incorrect.');
    await agent.post('/api/auth/signin').send(credentials).expect(200);
  });

  it('should not be able to change password if wrong verifyPassword is given', async function () {
    await agent.post('/api/auth/signin').send(credentials).expect(200);
    const res = await agent
      .post('/api/users/password')
      .send({
        newPassword: '1234567890Aa$',
        verifyPassword: '1234567890-ABC-123-Aa$',
        currentPassword: credentials.password,
      })
      .expect(400);
    res.body.message.should.equal('Passwords do not match.');
  });
  it('should not be able to change password if wrong currentPassword is given', async function () {
    await agent.post('/api/auth/signin').send(credentials).expect(200);
    const res = await agent
      .post('/api/users/password')
      .send({
        newPassword: '1234567890Aa$',
        verifyPassword: '1234567890Aa$',
        currentPassword: 'some_wrong_passwordAa$',
      })
      .expect(400);
    res.body.message.should.equal('Current password is incorrect.');
  });
  it('should not be able to change password if no new password is at all given', async function () {
    await agent.post('/api/auth/signin').send(credentials).expect(200);
    const res = await agent
      .post('/api/users/password')
      .send({
        newPassword: '',
        verifyPassword: '',
        currentPassword: credentials.password,
      })
      .expect(400);
    res.body.message.should.equal('Please provide a new password.');
  });
  it('should not be able to change password if no new password is at all given', async function () {
    const res = await agent
      .post('/api/users/password')
      .send({
        newPassword: '1234567890Aa$',
        verifyPassword: '1234567890Aa$',
        currentPassword: credentials.password,
      })
      .expect(403);
    res.body.message.should.equal('Forbidden.');
  });
});
