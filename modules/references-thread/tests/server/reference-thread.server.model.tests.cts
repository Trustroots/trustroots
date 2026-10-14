import type {
  MessageModel,
  MessageRecord,
  ReferenceThreadDocument,
  ReferenceThreadModel,
  ReferenceThreadRecord,
  ThreadModel,
  ThreadRecord,
  UserModelDocument,
  UserModel,
  UserRecord,
} from '../../../../testutils/server/model-contracts.mts';
/**
 * Module dependencies.
 */
const should: typeof import('should') = require('should');
const mongoose: typeof import('mongoose') = require('mongoose');
const utils: typeof import('../../../../testutils/server/data.server.testutil') = require('../../../../testutils/server/data.server.testutil');
const User = mongoose.model<UserRecord, UserModel>('User');
const Thread = mongoose.model<ThreadRecord, ThreadModel>('Thread');
const Message = mongoose.model<MessageRecord, MessageModel>('Message');
const ReferenceThread = mongoose.model<
  ReferenceThreadRecord,
  ReferenceThreadModel
>('ReferenceThread');
/**
 * Globals
 */
let user1: UserModelDocument;
let user2: UserModelDocument;
let message: Omit<MessageRecord, 'userFrom' | 'userTo'> & {
  notified: boolean;
  userFrom: InstanceType<typeof mongoose.Types.ObjectId> | null;
  userTo: InstanceType<typeof mongoose.Types.ObjectId> | null;
};
let thread: Omit<ThreadRecord, 'message' | 'userFrom' | 'userTo'> & {
  message: InstanceType<typeof mongoose.Types.ObjectId> | null;
  userFrom: InstanceType<typeof mongoose.Types.ObjectId> | null;
  userTo: InstanceType<typeof mongoose.Types.ObjectId> | null;
};
let referenceThread: ReferenceThreadDocument;
let referenceThreadData: Omit<
  ReferenceThreadRecord,
  'thread' | 'userFrom' | 'userTo'
> & {
  thread: InstanceType<typeof mongoose.Types.ObjectId> | null;
  userFrom: InstanceType<typeof mongoose.Types.ObjectId> | null;
  userTo: InstanceType<typeof mongoose.Types.ObjectId> | null;
};
/**
 * Unit tests
 */
describe('Reference Thread Model Unit Tests:', function () {
  beforeEach(function (done) {
    user1 = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test1@test.com',
      username: 'username1',
      password: 'password123',
      provider: 'local',
    });
    user2 = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test2@test.com',
      username: 'username2',
      password: 'password123',
      provider: 'local',
    });
    message = {
      content: 'Lorem ipsum',
      notified: true,
      userTo: null,
      userFrom: null,
      read: true,
      created: new Date(),
    };
    thread = {
      message: null,
      userTo: null,
      userFrom: null,
      read: true,
      updated: new Date(),
    };
    referenceThreadData = {
      thread: null,
      userFrom: null,
      userTo: null,
      reference: 'yes',
      created: new Date(),
    };
    // Create users and reference
    user1
      .save()
      .then(user1res => {
        referenceThreadData.userFrom = user1res._id;
        message.userFrom = user1res._id;
        thread.userFrom = user1res._id;
        user2
          .save()
          .then(user2res => {
            referenceThreadData.userTo = user2res._id;
            message.userTo = user2res._id;
            thread.userTo = user2res._id;
            new Message({
              ...message,
              userFrom: message.userFrom!,
              userTo: message.userTo!,
            })
              .save()
              .then(message2res => {
                thread.message = message2res._id;
                new Thread({
                  ...thread,
                  message: thread.message!,
                  userFrom: thread.userFrom!,
                  userTo: thread.userTo!,
                })
                  .save()
                  .then(thread2res => {
                    referenceThreadData.thread = thread2res._id;
                    referenceThread = new ReferenceThread({
                      ...referenceThreadData,
                      thread: referenceThreadData.thread!,
                      userFrom: referenceThreadData.userFrom!,
                      userTo: referenceThreadData.userTo!,
                    });
                    return done();
                  })
                  .catch(done);
              })
              .catch(done);
          })
          .catch(done);
      })
      .catch(done);
  });
  afterEach(utils.clearDatabase);
  describe('Method Save', function () {
    it('should be able to save without problems', function (done) {
      referenceThread
        .save()
        .then(() => {
          should.not.exist(null);
          return done();
        })
        .catch(done);
    });
    it('should be able to save without problems with reference text set to "no"', function (done) {
      referenceThread.reference = 'no';
      referenceThread
        .save()
        .then(() => {
          should.not.exist(null);
          return done();
        })
        .catch(done);
    });
    it('should be able to show an error when try to save with reference text set to something else than "yes" or "no"', function (done) {
      referenceThread.set('reference', 'beer');
      referenceThread
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
  });
});
