const request: typeof import('supertest') = require('supertest');
const mongoose: typeof import('mongoose') = require('mongoose');
type TestExpressModule =
  import('../../../../testutils/server/model-contracts.mts').TestExpressModule;
type TestAgent =
  import('../../../../testutils/server/model-contracts.mts').TestAgent;
const express: TestExpressModule = require('./../../../../config/lib/express.mjs');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil.mts');
require('should');
type FixtureUserId = import('mongoose').Types.ObjectId | string;
type AdminNoteRecord = {
  admin: FixtureUserId;
  user: FixtureUserId;
  note: string;
  date?: Date;
};
const AdminNote = mongoose.model<AdminNoteRecord>('AdminNote');
let app: import('../../../../testutils/server/model-contracts.mts').TestExpressApp;
let agent: TestAgent;
let adminUserId: FixtureUserId;
let notesUserId: FixtureUserId;
const noteInputHtml =
  '<p>test https://trustroots.org <script>alert()</script></p>';
const noteOutputHtml =
  '<p>test <a href="https://trustroots.org">trustroots.org</a> </p>';
const usersRaw = utils.generateUsers(3);
usersRaw[0].roles = ['user', 'admin'];
const credentialsAdmin = {
  username: usersRaw[0].username,
  password: usersRaw[0].password,
};
const credentialsRegular = {
  username: usersRaw[1].username,
  password: usersRaw[1].password,
};
describe('Admin Notes Log CRUD tests', () => {
  before(async function () {
    app = await express.init(mongoose.connection);
    agent = request.agent(app);
  });
  // Get application
  beforeEach(async () => {
    const users = await utils.saveUsers(usersRaw);
    adminUserId = users[0]._id;
    notesUserId = users[2]._id;
    const note = new AdminNote({
      date: new Date(),
      note: noteInputHtml,
      admin: adminUserId,
      user: notesUserId,
    });
    await note.save();
  });
  afterEach(utils.clearDatabase);
  describe('List notes', () => {
    it('non-authenticated users should not be allowed to read notes', () =>
      agent.get(`/api/admin/notes?userId=${notesUserId}`).expect(403));
    it('non-authenticated users should not be allowed to write notes', async () => {
      const { body } = await agent
        .post('/api/admin/notes')
        .send({
          userId: notesUserId,
          note: 'test',
        })
        .expect(403);
      body.message.should.equal('Forbidden.');
    });
    describe('As authenticated user...', () => {
      afterEach(async () => {
        await utils.signOut(agent);
      });
      it('non-admin users should not be allowed to read audit log', async () => {
        await utils.signIn(credentialsRegular, agent);
        const { body } = await agent
          .get(`/api/admin/notes?userId=${notesUserId}`)
          .expect(403);
        body.message.should.equal('Forbidden.');
      });
      it('non-admin users should not be allowed to write notes', async () => {
        await utils.signIn(credentialsRegular, agent);
        const { body } = await agent
          .post('/api/admin/notes')
          .send({
            userId: notesUserId,
            note: 'test',
          })
          .expect(403);
        body.message.should.equal('Forbidden.');
      });
      it('admin users should be allowed to read notes', async () => {
        await utils.signInPrivileged(credentialsAdmin, agent);
        const { body } = await agent
          .get(`/api/admin/notes?userId=${notesUserId}`)
          .expect(200);
        body.length.should.equal(1);
      });
      it('admin users should be allowed to write notes', async () => {
        await utils.signInPrivileged(credentialsAdmin, agent);
        const { body } = await agent
          .post('/api/admin/notes')
          .send({
            userId: notesUserId,
            note: 'test',
          })
          .expect(200);
        body.message.should.equal('Note saved.');
      });
      it('notes cannot be empty', async () => {
        await utils.signInPrivileged(credentialsAdmin, agent);
        const { body } = await agent
          .post('/api/admin/notes')
          .send({
            userId: notesUserId,
            note: '',
          })
          .expect(400);
        body.message.should.equal('Empty note.');
      });
      it('notes are formatted before returning', async () => {
        await utils.signInPrivileged(credentialsAdmin, agent);
        const { body } = await agent
          .get(`/api/admin/notes?userId=${notesUserId}`)
          .expect(200);

        // Script tag gets stripped out
        // URL is turned into a link
        body[0].note.should.equal(noteOutputHtml);
      });
    });
  });
});
