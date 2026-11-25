import mongoose from 'mongoose';
import request from 'supertest';
import express from './../../../../config/lib/express.mts';
import * as utils from '../../../../testutils/server/data.server.testutil.mts';
import sinon from 'sinon';
import mail from '../../../core/server/services/email.server.service.mts';
import should from 'should';
type Credentials = { username: string; password: string };
type AcquisitionStoryRow = {
  _id: string;
  username: string;
  acquisitionStory?: string;
  flagged: boolean;
  restrictionStatuses: string[];
};
describe('Admin acquisition stories CRUD tests', () => {
  let app: import('express').Express;
  let agent: ReturnType<typeof request.agent>;
  before(async function () {
    app = await express.init(mongoose.connection);
    agent = request.agent(app);
  });
  // Get application

  const acquisitionStories = [
    'A fictional friend.',
    'A fictional gathering.',
    'A fictional recommendation.',
  ];
  let credentialsAdmin: Credentials;
  let credentialsRegular: Credentials;
  beforeEach(async () => {
    const users = utils
      .generateUsersWithSharedPassword(acquisitionStories.length)
      .map((user, index) =>
        Object.assign(user, { acquisitionStory: acquisitionStories[index] }),
      );
    users[0].roles = ['user', 'admin'];
    users[2].roles = ['user', 'shadowban', 'suspended', 'volunteer'];
    const savedUsers = await utils.saveUsersWithCachedPasswords(users);
    credentialsAdmin = {
      username: savedUsers[0].username,
      password: users[0].password,
    };
    credentialsRegular = {
      username: savedUsers[1].username,
      password: users[1].password,
    };
  });
  afterEach(utils.clearDatabase);
  describe('Acquisition stories', () => {
    it('non-authenticated users should not be allowed to read acquisition stories', async () => {
      await agent
        .post('/api/admin/acquisition-stories')
        .set('X-Trustroots-Request', '1')
        .expect(403);
    });
    describe('As authenticated user...', () => {
      afterEach(async () => {
        sinon.restore();
        await utils.signOut(agent);
      });
      it('non-admin users should not be allowed to read acquisition stories', async () => {
        await utils.signIn(credentialsRegular, agent);
        await agent
          .post('/api/admin/acquisition-stories')
          .set('X-Trustroots-Request', '1')
          .expect(403);
      });
      it('greeters can read restriction statuses but cannot change roles', async () => {
        await mongoose
          .model('User')
          .updateOne(
            { username: credentialsRegular.username },
            { $set: { roles: ['user', 'welcome-team'] } },
          );
        await utils.signIn(credentialsRegular, agent);
        const { body }: { body: AcquisitionStoryRow[] } = await agent
          .post('/api/admin/acquisition-stories')
          .set('X-Trustroots-Request', '1')
          .expect(200);
        const target = body.find(
          row => row.acquisitionStory === acquisitionStories[2],
        );
        target!.restrictionStatuses.should.deepEqual([
          'suspended',
          'shadowban',
        ]);
        body.every(row => !Object.hasOwn(row, 'email')).should.equal(true);
        body
          .find(row => row.username === credentialsRegular.username)!
          .restrictionStatuses.should.deepEqual([]);
        await agent
          .post('/api/admin/user/change-role')
          .set('X-Trustroots-Request', '1')
          .send({ id: target!._id, role: 'shadowban', action: 'remove' })
          .expect(403);
      });
      it('lets greeters add an audited flag only to another acquisition-story member', async () => {
        const User = mongoose.model('User');
        const target = await User.findOne({
          acquisitionStory: acquisitionStories[2],
        }).orFail();
        const greeter = await User.findOneAndUpdate(
          { username: credentialsRegular.username },
          { $set: { roles: ['user', 'welcome-team'] } },
        ).orFail();
        const path = `/api/admin/acquisition-stories/${target._id}/flag`;

        await request(app)
          .post(path)
          .set('X-Trustroots-Request', '1')
          .expect(403);
        await utils.signIn(credentialsAdmin, agent);
        await agent.post(path).set('X-Trustroots-Request', '1').expect(403);
        await utils.signOut(agent);
        await utils.signIn(credentialsRegular, agent);
        await agent
          .post('/api/admin/acquisition-stories/invalid/flag')
          .set('X-Trustroots-Request', '1')
          .expect(400);
        await agent
          .post(`/api/admin/acquisition-stories/${greeter._id}/flag`)
          .set('X-Trustroots-Request', '1')
          .expect(400, { message: 'You cannot flag your own account.' });

        const other = await User.findOneAndUpdate(
          { username: credentialsAdmin.username },
          { $unset: { acquisitionStory: '' } },
        ).orFail();
        await agent
          .post(`/api/admin/acquisition-stories/${other._id}/flag`)
          .set('X-Trustroots-Request', '1')
          .expect(404);
        await User.updateOne(
          { _id: other._id },
          { $set: { acquisitionStory: '' } },
        );
        await agent
          .post(`/api/admin/acquisition-stories/${other._id}/flag`)
          .set('X-Trustroots-Request', '1')
          .expect(404);
        await agent.patch(path).set('X-Trustroots-Request', '1').expect(403);

        await agent
          .post(path)
          .set('X-Trustroots-Request', '1')
          .expect(200, { flagged: true });
        await agent
          .post(path)
          .set('X-Trustroots-Request', '1')
          .send({ flagged: false })
          .expect(200, { flagged: true });
        const saved = await User.findById(target._id).orFail();
        saved.roles.should.deepEqual([...target.roles, 'flagged']);
        should(saved.public).equal(target.public);
        const { body }: { body: AcquisitionStoryRow[] } = await agent
          .post('/api/admin/acquisition-stories')
          .set('X-Trustroots-Request', '1')
          .expect(200);
        body
          .find(row => row.username === target.username)!
          .flagged.should.equal(true);
        const audits = await mongoose.model('AuditLog').countDocuments({
          user: greeter._id,
          route: '/api/admin/acquisition-stories/:memberId/flag',
          'params.memberId': String(target._id),
          'body.flagged': true,
        });
        audits.should.equal(2);
      });
      it('lets a greeter resend signup confirmation for an unconfirmed acquisition story', async () => {
        const User = mongoose.model('User');
        const target = await User.findOne({
          acquisitionStory: acquisitionStories[2],
        }).exec();
        if (!target) throw new Error('Expected an acquisition-story member');
        await User.updateOne(
          { _id: target._id },
          {
            $set: {
              public: false,
              emailTemporary: 'signup-member@example.org',
            },
          },
        );
        await User.updateOne(
          { username: credentialsRegular.username },
          { $set: { roles: ['user', 'welcome-team'] } },
        );
        const send = sinon
          .stub(mail, 'sendSignupEmailConfirmation')
          .callsFake(
            (
              _user: Parameters<typeof mail.sendSignupEmailConfirmation>[0],
              done: Parameters<typeof mail.sendSignupEmailConfirmation>[1],
            ) => done(),
          );
        await utils.signIn(credentialsRegular, agent);

        const { body }: { body: { message: string } } = await agent
          .post(
            `/api/admin/acquisition-stories/${target._id.toString()}/resend-confirmation`,
          )
          .set('X-Trustroots-Request', '1')
          .expect(200);

        body.message.should.equal('Sent confirmation email.');
        send.calledOnce.should.equal(true);
        const updated = await User.findById(target._id).exec();
        should(updated?.public).equal(false);
        should(updated?.emailTemporary).equal('signup-member@example.org');
      });
      it('admin users should be allowed to read acquisition stories', async () => {
        await utils.signIn(credentialsAdmin, agent);
        const { body }: { body: AcquisitionStoryRow[] } = await agent
          .post('/api/admin/acquisition-stories')
          .set('X-Trustroots-Request', '1')
          .expect(200);
        body.length.should.equal(acquisitionStories.length);
        const member = await mongoose
          .model('User')
          .findOne({ username: credentialsRegular.username })
          .exec();
        should(
          body.find(row => row.username === credentialsRegular.username),
        ).have.property('email', member!.email);
        body
          .every(row => !Object.hasOwn(row, 'emailTemporary'))
          .should.equal(true);
        body.every(row => !Object.hasOwn(row, 'emailToken')).should.equal(true);
        body
          .find(row => row.acquisitionStory === acquisitionStories[2])!
          .restrictionStatuses.should.deepEqual(['suspended', 'shadowban']);
        body.every(row => !Object.hasOwn(row, 'roles')).should.equal(true);
      });
    });
  });
});
