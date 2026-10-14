/**
 * Module dependencies.
 */
const should: typeof import('should') = require('should');
const mongoose: typeof import('mongoose') = require('mongoose');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mjs') = require('../../../../testutils/server/data.server.testutil');
type SupportRequestRecord = {
  email?: string;
  username?: string;
  message: string;
  reportUser?: string;
  userAgent?: string;
  reportMember?: string;
  sent?: Date;
  user?: import('mongoose').Types.ObjectId;
  category?:
    'account' | 'reportMember' | 'reportBug' | 'volunteering' | 'other';
};
const User =
  mongoose.model<
    import('../../../../testutils/server/model-contracts.mts').UserRecord
  >('User');
const SupportRequest = mongoose.model<SupportRequestRecord>('SupportRequest');
/**
 * Globals
 */
let user: InstanceType<typeof User>;
let _support: Omit<SupportRequestRecord, 'message'> & {
  message?: string;
};
let support: InstanceType<typeof SupportRequest>;
/**
 * Unit tests
 */
describe('Support request Model Unit Tests:', function () {
  beforeEach(function (done) {
    user = new User({
      firstName: 'Joe',
      lastName: 'Doe',
      displayName: 'Joe Doe',
      email: 'test@test.com',
      username: 'joedoe',
      password: 'password123',
      provider: 'local',
    });
    _support = {
      email: 'joedoe@test.com',
      username: 'joedoe',
      message: 'Testing.',
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64; rv:10.0) Gecko/20100101 Firefox/10.0',
      reportMember: 'baduser',
    };
    support = new SupportRequest(_support);
    support.user = user._id;
    done();
  });
  after(utils.clearDatabase);
  describe('Method Save', function () {
    for (const category of [
      'account',
      'reportMember',
      'reportBug',
      'volunteering',
      'other',
    ]) {
      it(`retains the ${category} category`, async function () {
        const saved = await new SupportRequest({
          ..._support,
          category,
        }).save();
        saved.category!.should.equal(category);
      });
    }
    it('rejects unsupported categories', function () {
      const invalid = new SupportRequest({ ..._support, category: 'unknown' });
      should.exist(invalid.validateSync()?.errors?.category);
    });
    it('should be able to save without problems', function (done) {
      support
        .save()
        .then(supportRes => {
          should.not.exist(null);
          supportRes.email!.should.equal(_support.email);
          supportRes.username!.should.equal(_support.username);
          supportRes.message.should.equal(_support.message);
          supportRes.userAgent!.should.equal(_support.userAgent);
          supportRes.reportMember!.should.equal(_support.reportMember);
          supportRes.category!.should.equal('other');
          should.exist(supportRes.sent);
          return done();
        })
        .catch(done);
    });
    it('should be able to save without problems without user id', function (done) {
      const supportWithoutUser = new SupportRequest(_support);
      supportWithoutUser
        .save()
        .then(supportRes => {
          should.not.exist(null);
          should.not.exist(supportRes.user);
          return done();
        })
        .catch(done);
    });
    it('should not be able to save without message', function (done) {
      delete _support.message;
      const supportWithoutMessage = new SupportRequest(_support);
      supportWithoutMessage
        .save()
        .then(
          () => {
            throw new Error('Expected the operation to reject');
          },
          err => {
            should.exist(err);
            return done();
          },
        )
        .catch(done);
    });
    it('should be able to save without problems without any other fields than message', function (done) {
      const supportOnlyMessage = new SupportRequest({
        message: _support.message,
      });
      supportOnlyMessage
        .save()
        .then(supportRes => {
          should.not.exist(null);
          should.exist(supportRes.sent);
          supportRes.message.should.equal(_support.message);
          should.not.exist(supportRes.user);
          should.not.exist(supportRes.username);
          should.not.exist(supportRes.email);
          should.not.exist(supportRes.reportUser);
          should.not.exist(supportRes.userAgent);
          return done();
        })
        .catch(done);
    });
  });
});
