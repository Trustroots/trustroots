/**
 * Unit tests for the contacts controller middleware and error branches that
 * the route tests do not reach. Handlers are invoked directly with mock
 * req/res/next against the test database.
 */
const proxyquire = require('proxyquire').noCallThru();
const mongoose = require('mongoose');
const sinon = require('sinon');

const contactsController = require('../../server/controllers/contacts.server.controller');
const utils = require('../../../../testutils/server/data.server.testutil');
require('should');

const Contact = mongoose.model('Contact');

const controllerPath = '../../server/controllers/contacts.server.controller';
const emailServicePath = '../../../core/server/services/email.server.service';

function runHandler(invoke) {
  return new Promise(resolve => {
    const res = { statusCode: 200, body: null };
    const finish = () =>
      resolve({ res, nextCalled: res._next, nextArg: res._nextArg });
    res.status = function (code) {
      res.statusCode = code;
      return res;
    };
    res.send = function (body) {
      res.body = body;
      finish();
      return res;
    };
    res.json = function (body) {
      res.body = body;
      finish();
      return res;
    };
    const next = arg => {
      res._next = true;
      res._nextArg = arg;
      finish();
    };
    invoke(res, next);
  });
}

describe('Contacts controller unit tests', () => {
  let user1;
  let user2;

  beforeEach(async () => {
    [user1, user2] = await utils.saveUsers(
      utils.generateUsers(2, { public: true }),
    );
  });

  afterEach(() => {
    sinon.restore();
    return utils.clearDatabase();
  });

  describe('add', () => {
    it('rejects an invalid friend user id', async () => {
      const { res } = await runHandler(res =>
        contactsController.add(
          { user: user1, body: { friendUserId: 'bad-id' } },
          res,
        ),
      );
      res.statusCode.should.equal(400);
    });

    it('rejects a duplicate contact', async () => {
      await new Contact({
        userFrom: user1._id,
        userTo: user2._id,
        confirmed: false,
      }).save();

      const { res } = await runHandler(res =>
        contactsController.add(
          { user: user1, body: { friendUserId: user2._id.toString() } },
          res,
        ),
      );
      res.statusCode.should.equal(409);
      res.body.confirmed.should.be.false();
    });

    it('creates a contact and sends email', async () => {
      const { res } = await runHandler(res =>
        contactsController.add(
          {
            user: user1,
            body: {
              friendUserId: user2._id.toString(),
              message: '<b>Hi</b> friend',
            },
          },
          res,
        ),
      );
      res.statusCode.should.equal(200);
      res.body.message.should.match(/email was sent/);
    });

    it('responds with 400 when the contact lookup fails before creation', async () => {
      sinon.stub(Contact, 'findOne').returns({
        exec: cb => cb(new Error('lookup failed')),
      });

      const { res } = await runHandler(res =>
        contactsController.add(
          { user: user1, body: { friendUserId: user2._id.toString() } },
          res,
        ),
      );
      res.statusCode.should.equal(400);
    });

    it('responds with 400 when the friend does not exist', async () => {
      const { res } = await runHandler(res =>
        contactsController.add(
          {
            user: user1,
            body: { friendUserId: new mongoose.Types.ObjectId().toString() },
          },
          res,
        ),
      );
      res.statusCode.should.equal(400);
    });

    it('cleans up the contact when email sending fails', async () => {
      const controller = proxyquire(controllerPath, {
        [emailServicePath]: {
          sendConfirmContact: (from, to, contact, html, plain, cb) =>
            cb(new Error('mail failed')),
        },
      });

      const { res } = await runHandler(res =>
        controller.add(
          { user: user1, body: { friendUserId: user2._id.toString() } },
          res,
        ),
      );
      res.statusCode.should.equal(400);

      const contacts = await Contact.find({
        userFrom: user1._id,
        userTo: user2._id,
      });
      contacts.length.should.equal(0);
    });
  });

  describe('confirm', () => {
    it('responds with 403 when the user is not the receiver', async () => {
      const contact = await new Contact({
        userFrom: user1._id,
        userTo: user2._id,
        confirmed: false,
      }).save();
      const populated = await Contact.findById(contact._id).populate(
        'userTo userFrom',
      );

      const { res } = await runHandler(res =>
        contactsController.confirm({ user: user1, contact: populated }, res),
      );
      res.statusCode.should.equal(403);
    });

    it('responds with 400 when saving the confirmation fails', async () => {
      const contact = await new Contact({
        userFrom: user1._id,
        userTo: user2._id,
        confirmed: false,
      }).save();
      const populated = await Contact.findById(contact._id).populate(
        'userTo userFrom',
      );

      sinon.stub(Contact.prototype, 'save').callsFake(function (cb) {
        cb(new Error('save failed'));
      });

      const { res } = await runHandler(res =>
        contactsController.confirm({ user: user2, contact: populated }, res),
      );
      res.statusCode.should.equal(400);
    });

    it('confirms a contact for the receiving user', async () => {
      const contact = await new Contact({
        userFrom: user1._id,
        userTo: user2._id,
        confirmed: false,
      }).save();
      const populated = await Contact.findById(contact._id).populate(
        'userTo userFrom',
      );

      const { res } = await runHandler(res =>
        contactsController.confirm({ user: user2, contact: populated }, res),
      );
      res.statusCode.should.equal(200);
      res.body.confirmed.should.be.true();
    });
  });

  describe('remove', () => {
    it('responds with 400 when removal fails', async () => {
      const contact = await new Contact({
        userFrom: user1._id,
        userTo: user2._id,
        confirmed: true,
      }).save();

      sinon.stub(Contact.prototype, 'remove').callsFake(function (cb) {
        cb(new Error('remove failed'));
      });

      const { res } = await runHandler(res =>
        contactsController.remove({ contact }, res),
      );
      res.statusCode.should.equal(400);
    });

    it('removes a contact', async () => {
      const contact = await new Contact({
        userFrom: user1._id,
        userTo: user2._id,
        confirmed: true,
      }).save();

      const { res } = await runHandler(res =>
        contactsController.remove({ contact }, res),
      );
      res.statusCode.should.equal(200);
      res.body.message.should.equal('Contact removed.');
    });
  });

  describe('removeAllByUserId', () => {
    it('invokes the callback without error', done => {
      contactsController.removeAllByUserId(user1._id, err => {
        (err === null || err === undefined).should.be.true();
        done();
      });
    });

    it('allows callers to omit the callback', () => {
      sinon.stub(Contact, 'deleteMany').callsFake((query, cb) => cb());

      contactsController.removeAllByUserId(user1._id);

      Contact.deleteMany.calledOnce.should.be.true();
    });
  });

  describe('list and get', () => {
    it('returns the contacts list', async () => {
      const { res } = await runHandler(res =>
        contactsController.list({ contacts: [{ a: 1 }] }, res),
      );
      res.body.should.deepEqual([{ a: 1 }]);
    });

    it('returns an empty object when no contacts list was loaded', async () => {
      const { res } = await runHandler(res => contactsController.list({}, res));
      res.body.should.deepEqual({});
    });

    it('returns a single contact', async () => {
      const { res } = await runHandler(res =>
        contactsController.get({ contact: { _id: 'x' } }, res),
      );
      res.body._id.should.equal('x');
    });

    it('returns an empty object when no single contact was loaded', async () => {
      const { res } = await runHandler(res => contactsController.get({}, res));
      res.body.should.deepEqual({});
    });
  });

  describe('contactByUserId', () => {
    it('rejects an invalid user id', async () => {
      const { res } = await runHandler((res, next) =>
        contactsController.contactByUserId(
          { user: user1 },
          res,
          next,
          'bad-id',
        ),
      );
      res.statusCode.should.equal(400);
    });

    it('rejects looking up your own profile', async () => {
      const { res } = await runHandler((res, next) =>
        contactsController.contactByUserId(
          { user: user1 },
          res,
          next,
          user1._id,
        ),
      );
      res.statusCode.should.equal(400);
    });

    it('calls next without a public user', async () => {
      const [privateUser] = await utils.saveUsers(
        utils.generateUsers(1, { public: false }),
      );
      const { nextCalled } = await runHandler((res, next) =>
        contactsController.contactByUserId(
          { user: privateUser },
          res,
          next,
          user2._id.toString(),
        ),
      );
      nextCalled.should.be.true();
    });

    it('responds with 404 when no contact exists', async () => {
      const { res } = await runHandler((res, next) =>
        contactsController.contactByUserId(
          { user: user1 },
          res,
          next,
          user2._id.toString(),
        ),
      );
      res.statusCode.should.equal(404);
    });

    it('passes contact lookup errors to next', async () => {
      sinon.stub(Contact, 'findOne').returns({
        populate: () => ({
          exec: cb => cb(new Error('contact lookup failed')),
        }),
      });

      const { nextArg } = await runHandler((res, next) =>
        contactsController.contactByUserId(
          { user: user1 },
          res,
          next,
          user2._id.toString(),
        ),
      );
      nextArg.should.be.Error();
      nextArg.message.should.equal('contact lookup failed');
    });

    it('attaches the contact and calls next', async () => {
      await new Contact({
        userFrom: user1._id,
        userTo: user2._id,
        confirmed: true,
      }).save();

      const req = { user: user1 };
      const { nextCalled } = await runHandler((res, next) =>
        contactsController.contactByUserId(
          req,
          res,
          next,
          user2._id.toString(),
        ),
      );
      nextCalled.should.be.true();
      req.contact.should.be.an.Object();
    });
  });

  describe('contactById', () => {
    it('rejects an invalid contact id', async () => {
      const { res } = await runHandler((res, next) =>
        contactsController.contactById({ user: user1 }, res, next, 'bad-id'),
      );
      res.statusCode.should.equal(400);
    });

    it('responds with 404 for a contact the user does not belong to', async () => {
      const [stranger] = await utils.saveUsers(
        utils.generateUsers(1, { public: true }),
      );
      const contact = await new Contact({
        userFrom: user1._id,
        userTo: user2._id,
        confirmed: true,
      }).save();

      const { res } = await runHandler((res, next) =>
        contactsController.contactById(
          { user: stranger },
          res,
          next,
          contact._id.toString(),
        ),
      );
      res.statusCode.should.equal(404);
    });

    it('passes contact id lookup errors to next', async () => {
      sinon.stub(Contact, 'findById').returns({
        populate: () => ({
          exec: cb => cb(new Error('contact id lookup failed')),
        }),
      });

      const { nextArg } = await runHandler((res, next) =>
        contactsController.contactById(
          { user: user1 },
          res,
          next,
          new mongoose.Types.ObjectId().toString(),
        ),
      );
      nextArg.should.be.Error();
      nextArg.message.should.equal('contact id lookup failed');
    });

    it('attaches the contact for a participant', async () => {
      const contact = await new Contact({
        userFrom: user1._id,
        userTo: user2._id,
        confirmed: true,
      }).save();

      const req = { user: user1 };
      const { nextCalled } = await runHandler((res, next) =>
        contactsController.contactById(req, res, next, contact._id.toString()),
      );
      nextCalled.should.be.true();
      req.contact._id.toString().should.equal(contact._id.toString());
    });
  });

  describe('filterByCommon', () => {
    it('calls next when there are no contacts to filter', async () => {
      const req = { user: user1, contacts: [] };
      const { nextCalled } = await runHandler((res, next) =>
        contactsController.filterByCommon(req, res, next),
      );
      nextCalled.should.be.true();
    });

    it('returns an empty list when the user has no confirmed contacts', async () => {
      const req = {
        user: user1,
        contacts: [{ user: { _id: user2._id } }],
      };
      const { nextCalled } = await runHandler((res, next) =>
        contactsController.filterByCommon(req, res, next),
      );
      nextCalled.should.be.true();
      req.contacts.length.should.equal(0);
    });

    it('calls next with a database error', async () => {
      sinon.stub(Contact, 'find').returns({
        exec: cb => cb(new Error('find failed')),
      });

      const req = {
        user: user1,
        contacts: [{ user: { _id: user2._id } }],
      };
      const { nextArg } = await runHandler((res, next) =>
        contactsController.filterByCommon(req, res, next),
      );
      nextArg.should.be.Error();
    });

    it('keeps only contacts shared with the authenticated user', async () => {
      const [user3] = await utils.saveUsers(
        utils.generateUsers(1, { public: true }),
      );
      await new Contact({
        userFrom: user1._id,
        userTo: user2._id,
        confirmed: true,
      }).save();
      await new Contact({
        userFrom: user1._id,
        userTo: user3._id,
        confirmed: true,
      }).save();

      const req = {
        user: user1,
        contacts: [
          { user: { _id: user2._id } },
          { user: { _id: user3._id } },
          { user: { _id: new mongoose.Types.ObjectId() } },
        ],
      };
      const { nextCalled } = await runHandler((res, next) =>
        contactsController.filterByCommon(req, res, next),
      );
      nextCalled.should.be.true();
      req.contacts.length.should.equal(2);
    });

    it('matches contacts when authenticated user is the receiving side', async () => {
      await new Contact({
        userFrom: user2._id,
        userTo: user1._id,
        confirmed: true,
      }).save();

      const req = {
        user: user1,
        contacts: [{ user: { _id: user2._id } }],
      };
      const { nextCalled } = await runHandler((res, next) =>
        contactsController.filterByCommon(req, res, next),
      );
      nextCalled.should.be.true();
      req.contacts.length.should.equal(1);
    });
  });

  describe('contactListByUser', () => {
    it('rejects an invalid user id', async () => {
      const { res } = await runHandler((res, next) =>
        contactsController.contactListByUser(
          { user: user1 },
          res,
          next,
          'bad-id',
        ),
      );
      res.statusCode.should.equal(400);
    });

    it('loads contacts for another user', async () => {
      await new Contact({
        userFrom: user1._id,
        userTo: user2._id,
        confirmed: true,
      }).save();

      const req = { user: user2 };
      const { nextCalled } = await runHandler((res, next) =>
        contactsController.contactListByUser(
          req,
          res,
          next,
          user1._id.toString(),
        ),
      );
      nextCalled.should.be.true();
      req.contacts.length.should.equal(1);
    });

    it('passes aggregate errors to next', async () => {
      sinon.stub(Contact, 'aggregate').returns({
        exec: cb => cb(new Error('aggregate failed')),
      });

      const { nextArg } = await runHandler((res, next) =>
        contactsController.contactListByUser(
          { user: user1 },
          res,
          next,
          user2._id.toString(),
        ),
      );
      nextArg.should.be.Error();
      nextArg.message.should.equal('aggregate failed');
    });

    it('passes missing aggregate results to next', async () => {
      sinon.stub(Contact, 'aggregate').returns({
        exec: cb => cb(null, null),
      });

      const { nextArg } = await runHandler((res, next) =>
        contactsController.contactListByUser(
          { user: user1 },
          res,
          next,
          user2._id.toString(),
        ),
      );
      nextArg.should.be.Error();
      nextArg.message.should.equal('Failed to load contacts.');
    });
  });
});
