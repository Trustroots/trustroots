/**
 * Unit tests for the admin notes controller.
 */
const mongoose = require('mongoose');
const sinon = require('sinon');

const adminNotes = require('../../server/controllers/admin.notes.server.controller');
const errorService = require('../../../core/server/services/error.server.service');
const utils = require('../../../../testutils/server/data.server.testutil');
require('should');

const AdminNote = mongoose.model('AdminNote');

function mockResponse() {
  let resolveResponse;
  const promise = new Promise(resolve => {
    resolveResponse = resolve;
  });
  const res = { statusCode: 200, body: null };
  res.status = function (code) {
    res.statusCode = code;
    return res;
  };
  res.send = function (body) {
    res.body = body;
    resolveResponse(res);
    return res;
  };
  res.waitForResponse = () => promise;
  return res;
}

describe('Admin notes controller unit tests', () => {
  afterEach(() => {
    sinon.restore();
    return utils.clearDatabase();
  });

  describe('addNote', () => {
    it('rejects empty notes', async () => {
      const res = mockResponse();
      await adminNotes.addNote(
        { body: { userId: new mongoose.Types.ObjectId(), note: '   ' } },
        res,
      );

      res.statusCode.should.equal(400);
      res.body.message.should.equal('Empty note.');
    });

    it('rejects invalid user ids', async () => {
      const res = mockResponse();
      await adminNotes.addNote(
        {
          body: { userId: 'not-an-object-id', note: 'test' },
          user: { _id: 'admin' },
        },
        res,
      );

      res.statusCode.should.equal(400);
      res.body.message.should.equal(
        errorService.getErrorMessageByKey('invalid-id'),
      );
    });

    it('saves a sanitized note', async () => {
      const users = await utils.saveUsers(utils.generateUsers(2));
      const admin = users[0];
      const target = users[1];

      const res = mockResponse();
      await adminNotes.addNote(
        {
          body: {
            userId: target._id.toString(),
            note: '<p>hello <script>alert()</script></p>',
          },
          user: admin,
        },
        res,
      );

      res.body.message.should.equal('Note saved.');

      const saved = await AdminNote.findOne({ user: target._id }).exec();
      saved.note.should.not.containEql('script');
      saved.admin.toString().should.equal(admin._id.toString());
    });

    it('returns 400 when saving the note fails', async () => {
      const users = await utils.saveUsers(utils.generateUsers(2));
      const admin = users[0];
      const target = users[1];
      sinon.stub(AdminNote.prototype, 'save').rejects(new Error('save failed'));

      const res = mockResponse();
      await adminNotes.addNote(
        {
          body: { userId: target._id.toString(), note: 'test note' },
          user: admin,
        },
        res,
      );

      res.statusCode.should.equal(400);
    });
  });

  describe('getNotes', () => {
    it('rejects invalid user ids', async () => {
      const res = mockResponse();
      await adminNotes.getNotes({ query: { userId: 'bad-id' } }, res);

      res.statusCode.should.equal(400);
      res.body.message.should.equal(
        errorService.getErrorMessageByKey('invalid-id'),
      );
    });

    it('returns notes for a user', async () => {
      const users = await utils.saveUsers(utils.generateUsers(2));
      const admin = users[0];
      const target = users[1];

      await new AdminNote({
        admin: admin._id,
        user: target._id,
        note: '<p>saved note</p>',
      }).save();

      const res = mockResponse();
      adminNotes.getNotes({ query: { userId: target._id.toString() } }, res);
      await res.waitForResponse();

      res.body.length.should.equal(1);
      res.body[0].note.should.equal('<p>saved note</p>');
      res.body[0].admin.username.should.equal(admin.username);
    });

    it('returns an empty array when a user has no notes', async () => {
      const users = await utils.saveUsers(utils.generateUsers(1));

      const res = mockResponse();
      adminNotes.getNotes({ query: { userId: users[0]._id.toString() } }, res);
      await res.waitForResponse();

      res.body.should.eql([]);
    });

    it('returns an empty array when note lookup returns null', async () => {
      sinon.stub(AdminNote, 'find').returns({
        sort: () => ({
          populate: () => ({
            exec: cb => cb(null, null),
          }),
        }),
      });

      const res = mockResponse();
      adminNotes.getNotes(
        { query: { userId: new mongoose.Types.ObjectId().toString() } },
        res,
      );
      await res.waitForResponse();

      res.body.should.eql([]);
    });

    it('returns 400 when note lookup fails', async () => {
      sinon.stub(AdminNote, 'find').returns({
        sort: () => ({
          populate: () => ({
            exec: cb => cb(new Error('lookup failed')),
          }),
        }),
      });

      const res = mockResponse();
      adminNotes.getNotes(
        { query: { userId: new mongoose.Types.ObjectId().toString() } },
        res,
      );
      const response = await res.waitForResponse();
      response.statusCode.should.equal(400);
    });
  });
});
