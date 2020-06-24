const request = require('supertest');
const path = require('path');
const mongoose = require('mongoose');
const express = require(path.resolve('./config/lib/express'));
const utils = require(path.resolve('./testutils/server/data.server.testutil'));

const AdminNote = mongoose.model('AdminNote');

describe('Admin Notes Log CRUD tests', () => {
  // Get application
  const app = express.init(mongoose.connection);
  const agent = request.agent(app);
  let adminUserId;
  let notesUserId;
  const noteInputHtml =
    '<p>test https://trustroots.org <script>alert()</script></p>';
  const noteOutputHtml =
    '<p>test <a href="https://trustroots.org">trustroots.org</a> </p>';

  const _usersRaw = utils.generateUsers(3);
  _usersRaw[0].roles = ['user', 'admin'];

  const credentialsAdmin = {
    username: _usersRaw[0].username,
    password: _usersRaw[0].password,
  };

  const credentialsRegular = {
    username: _usersRaw[1].username,
    password: _usersRaw[1].password,
  };

  beforeEach(async () => {
    const _users = await utils.saveUsers(_usersRaw);
    adminUserId = _users[0]._id;
    notesUserId = _users[2]._id;

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
        await utils.signIn(credentialsAdmin, agent);

        const { body } = await agent
          .get(`/api/admin/notes?userId=${notesUserId}`)
          .expect(200);

        body.length.should.equal(1);
      });

      it('admin users should be allowed to write notes', async () => {
        await utils.signIn(credentialsAdmin, agent);

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
        await utils.signIn(credentialsAdmin, agent);

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
        await utils.signIn(credentialsAdmin, agent);

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
