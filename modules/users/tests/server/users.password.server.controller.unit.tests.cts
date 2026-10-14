/**
 * Unit tests for password controller validation and reset branches.
 */
const mockModule: typeof import('../../../../testutils/server/mock-module.mts').default = require('../../../../testutils/server/mock-module');
const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');

const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil');
const testutils: typeof import('../../../../testutils/server/server.testutil.mts') = require('../../../../testutils/server/server.testutil');
const errorService: typeof import('../../../core/server/services/error.server.service.mjs').default = require('../../../core/server/services/error.server.service.mjs');
require('should');

type UserRecord =
  import('../../../../testutils/server/model-contracts.mts').UserRecord;
interface PasswordUserRecord extends UserRecord {
  resetPasswordExpires?: Date;
}
type PasswordUserDocument =
  import('mongoose').HydratedDocument<PasswordUserRecord>;
type PasswordUserModel = import('mongoose').Model<PasswordUserRecord> &
  import('../../../../testutils/server/model-contracts.mts').UserStatics;
const User = mongoose.model<PasswordUserRecord, PasswordUserModel>('User');
interface PasswordBody {
  username?: string;
  newPassword?: string;
  verifyPassword?: string;
  currentPassword?: string;
}
interface PasswordRequest {
  body?: PasswordBody;
  params?: { token?: string };
  query?: { utm_source?: string; utm_medium?: string; utm_campaign?: string };
  user?: { id: string };
  login?: (
    user: PasswordUserDocument,
    callback: (error?: Error | null) => void,
  ) => void;
}
interface PasswordResponseBody {
  message?: string;
  username?: string;
}
interface DeferredResponse {
  statusCode: number;
  body: PasswordResponseBody;
  redirectUrl: string | null;
  status(code: number): this;
  send(body: PasswordResponseBody): this;
  json(body: PasswordResponseBody): this;
  redirect(url: string): this;
  waitForResponse(): Promise<DeferredResponse>;
}
interface PasswordController {
  forgot(
    request: PasswordRequest,
    response: DeferredResponse,
    next?: () => void,
  ): void;
  validateResetToken(
    request: PasswordRequest,
    response: DeferredResponse,
  ): void;
  reset(
    request: PasswordRequest,
    response: DeferredResponse,
    next?: () => void,
  ): void;
  changePassword(
    request: PasswordRequest,
    response: DeferredResponse,
    next?: () => void,
  ): void;
}

const controllerPath =
  '../../server/controllers/users.password.server.controller.mjs';
const emailServicePath =
  '../../../core/server/services/email.server.service.mjs';

function deferredResponse(): DeferredResponse {
  let resolveResponse: (response: DeferredResponse) => void = () => {};
  const promise = new Promise<DeferredResponse>(resolve => {
    resolveResponse = resolve;
  });
  const res: DeferredResponse = {
    statusCode: 200,
    body: {},
    redirectUrl: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    send(body) {
      res.body = body;
      resolveResponse(res);
      return res;
    },
    json(body) {
      res.body = body;
      resolveResponse(res);
      return res;
    },
    redirect(url) {
      res.redirectUrl = url;
      resolveResponse(res);
      return res;
    },
    waitForResponse() {
      return promise;
    },
  };
  return res;
}

async function findUser(id: unknown): Promise<PasswordUserDocument> {
  const user = await User.findById(id);
  if (!user) throw new Error('Expected test user to exist');
  return user;
}

function loadPasswordController(): PasswordController {
  return mockModule<PasswordController>(require.resolve(controllerPath), {
    [emailServicePath]: {
      sendResetPassword: (
        user: PasswordUserDocument,
        cb: (error?: Error) => void,
      ) => cb(),
      sendResetPasswordConfirm: (
        user: PasswordUserDocument,
        cb: (error?: Error) => void,
      ) => cb(),
    },
  });
}

interface LookupUserDouble {
  email?: string;
  username?: string;
  save(callback: (error?: Error | null) => void): void;
}
type LegacyFindOneStub = import('sinon').SinonStub<
  [
    import('mongoose').FilterQuery<PasswordUserRecord>,
    unknown,
    (error: Error | null, user: LookupUserDouble | null) => void,
  ],
  void
>;
function stubLegacyFindOne(): LegacyFindOneStub {
  return sinon.stub(User, 'findOne') as unknown as LegacyFindOneStub;
}
type FailedUpdateStub = import('sinon').SinonStub<
  [
    unknown,
    unknown,
    unknown,
    (error: Error | null, user?: PasswordUserDocument | null) => void,
  ],
  void
>;
type FailedLookupStub = import('sinon').SinonStub<
  [unknown, (error: Error | null, user?: PasswordUserDocument | null) => void],
  void
>;

describe('Password controller unit tests', () => {
  const jobs = testutils.catchJobs();

  afterEach(async () => {
    sinon.restore();
    jobs.length = 0;
    await utils.clearDatabase();
  });

  describe('forgot', () => {
    it('requires a username or email', async () => {
      const controller = loadPasswordController();
      const res = deferredResponse();
      controller.forgot({ body: {} }, res, () => {});
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('returns the generic acknowledgement when the account does not exist', async () => {
      const controller = loadPasswordController();
      const res = deferredResponse();
      controller.forgot({ body: { username: 'nobody-here' } }, res, () => {});
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      res.body.message!.should.equal(
        'If an account matches that username or email, we will send recovery instructions.',
      );
    });

    it('returns the same acknowledgement when sending the reset email fails', async () => {
      const controller = mockModule<PasswordController>(
        require.resolve(controllerPath),
        {
          [emailServicePath]: {
            sendResetPassword: (
              _user: PasswordUserDocument,
              cb: (error?: Error) => void,
            ) => cb(new Error('smtp down')),
          },
        },
      );
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      const res = deferredResponse();
      controller.forgot(
        { body: { username: userDoc.username } },
        res,
        () => {},
      );
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      res.body.message!.should.equal(
        'If an account matches that username or email, we will send recovery instructions.',
      );
    });

    it('acknowledges before a stalled email provider responds', async () => {
      let startDelivery: () => void = () => {};
      const deliveryStarted = new Promise<void>(resolve => {
        startDelivery = resolve;
      });
      const controller = mockModule<PasswordController>(
        require.resolve(controllerPath),
        {
          [emailServicePath]: {
            sendResetPassword: () => {
              startDelivery();
            },
          },
        },
      );
      const fakeUser: LookupUserDouble = {
        save: callback => callback(),
      };
      stubLegacyFindOne().callsFake((query, fields, callback) => {
        callback(null, fakeUser);
      });
      const res = deferredResponse();

      controller.forgot({ body: { username: 'known-member' } }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      res.body.message!.should.equal(
        'If an account matches that username or email, we will send recovery instructions.',
      );

      await deliveryStarted;
    });

    it('sends a reset email for a valid account', async () => {
      const controller = loadPasswordController();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      const res = deferredResponse();
      controller.forgot(
        { body: { username: userDoc.username } },
        res,
        () => {},
      );
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      res.body.message!.should.equal(
        'If an account matches that username or email, we will send recovery instructions.',
      );
    });

    it('returns the generic acknowledgement when saving the reset token fails', async () => {
      const controller = loadPasswordController();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);

      stubLegacyFindOne().callsFake(function (query, fields, cb) {
        cb(null, {
          email: userDoc.email,
          username: userDoc.username,
          save(saveCb) {
            saveCb(new Error('save failed'));
          },
        });
      });

      const res = deferredResponse();
      controller.forgot({ body: { username: userDoc.username } }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      res.body.message!.should.equal(
        'If an account matches that username or email, we will send recovery instructions.',
      );
    });
  });

  describe('validateResetToken', () => {
    it('redirects invalid tokens to the invalid page', async () => {
      const controller = loadPasswordController();
      const res = deferredResponse();
      controller.validateResetToken(
        { body: {}, params: { token: 'bad-token' } },
        res,
      );
      await res.waitForResponse();
      res.redirectUrl!.should.equal('/password/reset/invalid');
    });

    it('redirects valid tokens to the reset form', async () => {
      const controller = loadPasswordController();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.resetPasswordToken = 'valid-token';
      userDoc.resetPasswordExpires = new Date(Date.now() + 3600000);
      await userDoc.save();

      const res = deferredResponse();
      controller.validateResetToken(
        { body: {}, params: { token: 'valid-token' } },
        res,
      );
      await res.waitForResponse();
      res.redirectUrl!.should.equal('/password/reset/valid-token');
    });

    it('preserves UTM parameters on valid token redirects', async () => {
      const controller = loadPasswordController();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.resetPasswordToken = 'valid-token';
      userDoc.resetPasswordExpires = new Date(Date.now() + 3600000);
      await userDoc.save();

      const res = deferredResponse();
      controller.validateResetToken(
        {
          body: {},
          params: { token: 'valid-token' },
          query: {
            utm_source: 'newsletter',
            utm_medium: 'email',
            utm_campaign: 'reset',
          },
        },
        res,
      );
      await res.waitForResponse();
      res.redirectUrl!.should.containEql('/password/reset/valid-token');
      res.redirectUrl!.should.containEql('utm_source=newsletter');
      res.redirectUrl!.should.containEql('utm_medium=email');
      res.redirectUrl!.should.containEql('utm_campaign=reset');
    });
  });

  describe('reset', () => {
    it('rejects an invalid token', async () => {
      const controller = loadPasswordController();
      const res = deferredResponse();
      controller.reset(
        {
          params: { token: 'missing' },
          body: { newPassword: 'newpass', verifyPassword: 'newpass' },
          login: () => {},
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('resets the password and logs the user in', async () => {
      const controller = loadPasswordController();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.resetPasswordToken = 'reset-token';
      userDoc.resetPasswordExpires = new Date(Date.now() + 3600000);
      await userDoc.save();

      const res = deferredResponse();
      controller.reset(
        {
          params: { token: 'reset-token' },
          body: {
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
          login: (user, cb) => cb(),
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      res.body.username!.should.equal(userDoc.username);
    });

    it('returns 400 when login fails after reset', async () => {
      const controller = loadPasswordController();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.resetPasswordToken = 'reset-token';
      userDoc.resetPasswordExpires = new Date(Date.now() + 3600000);
      await userDoc.save();

      const res = deferredResponse();
      controller.reset(
        {
          params: { token: 'reset-token' },
          body: {
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
          login: (user, cb) => cb(new Error('login failed')),
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('returns 400 when saving the reset password fails', async () => {
      const controller = loadPasswordController();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.resetPasswordToken = 'reset-token';
      userDoc.resetPasswordExpires = new Date(Date.now() + 3600000);
      await userDoc.save();

      (
        sinon.stub(User, 'findOneAndUpdate') as unknown as FailedUpdateStub
      ).callsFake((_query, _update, _options, callback) =>
        callback(new Error('save failed')),
      );

      const res = deferredResponse();
      controller.reset(
        {
          params: { token: 'reset-token' },
          body: {
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
          login: (user, cb) => cb(),
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      res.body.message!.should.equal('Password reset failed.');
    });

    it('rejects mismatched passwords', async () => {
      const controller = loadPasswordController();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.resetPasswordToken = 'reset-token';
      userDoc.resetPasswordExpires = new Date(Date.now() + 3600000);
      await userDoc.save();

      const res = deferredResponse();
      controller.reset(
        {
          params: { token: 'reset-token' },
          body: { newPassword: 'newpass', verifyPassword: 'different' },
          login: () => {},
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      res.body.message!.should.equal('Passwords do not match.');
    });

    it('still resets the password when the confirmation email fails', async () => {
      const controller = mockModule<PasswordController>(
        require.resolve(controllerPath),
        {
          [emailServicePath]: {
            sendResetPassword: (
              user: PasswordUserDocument,
              cb: (error?: Error) => void,
            ) => cb(),
            sendResetPasswordConfirm: (
              user: PasswordUserDocument,
              cb: (error?: Error) => void,
            ) => cb(new Error('confirm email failed')),
          },
        },
      );
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.resetPasswordToken = 'reset-token';
      userDoc.resetPasswordExpires = new Date(Date.now() + 3600000);
      await userDoc.save();

      const res = deferredResponse();
      controller.reset(
        {
          params: { token: 'reset-token' },
          body: {
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
          login: (user, cb) => cb(),
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      res.body.username!.should.equal(userDoc.username);
    });
  });

  describe('changePassword', () => {
    it('responds with 403 without a user', async () => {
      const controller = loadPasswordController();
      const res = deferredResponse();
      controller.changePassword({ body: {} }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(403);
    });

    it('requires a new password', async () => {
      const controller = loadPasswordController();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const res = deferredResponse();
      controller.changePassword(
        { user: { id: saved._id.toString() }, body: {} },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('rejects mismatched new passwords', async () => {
      const controller = loadPasswordController();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const res = deferredResponse();
      controller.changePassword(
        {
          user: { id: saved._id.toString() },
          body: {
            currentPassword: 'oldpassword1',
            newPassword: 'newpassword123',
            verifyPassword: 'different-password',
          },
          login: () => {},
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      res.body.message!.should.equal('Passwords do not match.');
    });

    it('rejects an incorrect current password', async () => {
      const controller = loadPasswordController();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.password = 'oldpassword1';
      await userDoc.save();

      const res = deferredResponse();
      controller.changePassword(
        {
          user: { id: saved._id.toString() },
          body: {
            currentPassword: 'wrong-password',
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
          login: () => {},
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      res.body.message!.should.equal('Current password is incorrect.');
    });

    it('uses error status and default message for password lookup failures', async () => {
      const controller = loadPasswordController();
      const lookupError = Object.assign(new Error(''), { status: 418 });
      (sinon.stub(User, 'findById') as unknown as FailedLookupStub).callsFake(
        (_id, callback) => callback(lookupError),
      );

      const res = deferredResponse();
      controller.changePassword(
        {
          user: { id: new mongoose.Types.ObjectId().toString() },
          body: {
            currentPassword: 'oldpassword1',
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
          login: () => {},
        },
        res,
      );
      await res.waitForResponse();

      res.statusCode.should.equal(418);
      res.body.message!.should.equal(
        errorService.getErrorMessageByKey('default'),
      );
    });

    it('changes the password for a valid user', async () => {
      const controller = loadPasswordController();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.password = 'oldpassword1';
      await userDoc.save();

      const res = deferredResponse();
      controller.changePassword(
        {
          user: { id: saved._id.toString() },
          body: {
            currentPassword: 'oldpassword1',
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
          login: (user, cb) => cb(),
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      res.body.message!.should.equal('Password changed successfully!');
    });

    it('returns 400 when login fails after changing the password', async () => {
      const controller = loadPasswordController();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.password = 'oldpassword1';
      await userDoc.save();

      const res = deferredResponse();
      controller.changePassword(
        {
          user: { id: saved._id.toString() },
          body: {
            currentPassword: 'oldpassword1',
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
          login: (user, cb) => cb(new Error('login failed')),
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      res.body.message!.should.equal('login failed');
    });

    it('still succeeds when the password change confirmation email fails', async () => {
      const controller = mockModule<PasswordController>(
        require.resolve(controllerPath),
        {
          [emailServicePath]: {
            sendResetPassword: (
              user: PasswordUserDocument,
              cb: (error?: Error) => void,
            ) => cb(),
            sendResetPasswordConfirm: (
              user: PasswordUserDocument,
              cb: (error?: Error) => void,
            ) => cb(new Error('confirm email failed')),
          },
        },
      );
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await findUser(saved._id);
      userDoc.password = 'oldpassword1';
      await userDoc.save();

      const res = deferredResponse();
      controller.changePassword(
        {
          user: { id: saved._id.toString() },
          body: {
            currentPassword: 'oldpassword1',
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
          login: (user, cb) => cb(),
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      res.body.message!.should.equal('Password changed successfully!');
    });
  });
});
