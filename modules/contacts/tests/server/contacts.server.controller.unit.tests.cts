import type {
  ContactDocument,
  ContactModel,
  ContactRecord,
  UserDocument,
} from '../../../../testutils/server/model-contracts.mts';
/**
 * Unit tests for the contacts controller middleware and error branches that
 * the route tests do not reach. Handlers are invoked directly with mock
 * req/res/next against the test database.
 */
const mongoose: typeof import('mongoose') = require('mongoose');
const should: typeof import('should') = require('should');
const sinon: typeof import('sinon') = require('sinon');

const contactsController: typeof import('./../../server/controllers/contacts.server.controller.mjs') = require('./../../server/controllers/contacts.server.controller.mjs');
const utils: typeof import('../../../../testutils/server/data.server.testutil') = require('../../../../testutils/server/data.server.testutil');

const Contact = mongoose.model<ContactRecord, ContactModel>('Contact');

const emailService: typeof import('./../../../core/server/services/email.server.service.mjs') = require('./../../../core/server/services/email.server.service.mjs');

interface ControllerResponseBody extends Record<string, unknown> {
  confirmed?: boolean;
  message?: string;
  _id?: string | import('mongoose').Types.ObjectId;
}

interface MockControllerResponse {
  statusCode: number;
  body: ControllerResponseBody;
  _next?: boolean;
  _nextArg?: unknown;
  status(code: number): MockControllerResponse;
  send(body: unknown): MockControllerResponse;
  json(body: unknown): MockControllerResponse;
}

type ContactRequestEntry = { user: { _id: UserDocument['_id'] } };

type TestCallbackQuery = {
  populate(...args: string[]): TestCallbackQuery;
  exec(
    callback?: (error: unknown, result?: unknown) => void,
  ): TestCallbackQuery | Promise<unknown>;
};

function callbackQuery(error: unknown, result?: unknown): TestCallbackQuery {
  const query: TestCallbackQuery = {
    populate() {
      return query;
    },
    exec(callback) {
      if (callback) {
        callback(error, result);
        return query;
      }
      return error ? Promise.reject(error) : Promise.resolve(result);
    },
  };
  return query;
}

type HandlerResult = {
  res: MockControllerResponse;
  nextCalled: boolean;
  nextArg: unknown;
};

function runHandler(
  invoke: (
    res: import('express').Response,
    next: (arg?: unknown) => void,
  ) => unknown,
): Promise<HandlerResult> {
  return new Promise(resolve => {
    const res: MockControllerResponse = {
      statusCode: 200,
      body: {},
      status(code: number) {
        res.statusCode = code;
        return res;
      },
      send(body: unknown) {
        res.body = body as ControllerResponseBody;
        finish();
        return res;
      },
      json(body: unknown) {
        res.body = body as ControllerResponseBody;
        finish();
        return res;
      },
    };
    function finish() {
      resolve({ res, nextCalled: res._next === true, nextArg: res._nextArg });
    }
    const next = (arg?: unknown) => {
      res._next = true;
      res._nextArg = arg;
      finish();
    };
    invoke(res as unknown as import('express').Response, next);
  });
}

describe('Contacts controller unit tests', () => {
  let user1: UserDocument;
  let user2: UserDocument;

  beforeEach(async () => {
    [user1, user2] = await utils.saveUsersWithCachedPasswords(
      utils.generateUsersWithSharedPassword(2, { public: true }),
    );
  });

  afterEach(() => {
    sinon.restore();
    return utils.clearDatabase();
  });

  describe('add', () => {
    for (const blocker of ['sender', 'recipient']) {
      it(`does not create or email a request when the ${blocker} blocked the other member`, async () => {
        const blockedBy = blocker === 'sender' ? user1 : user2;
        blockedBy.blocked = [
          new mongoose.Types.ObjectId(
            (blocker === 'sender' ? user2._id : user1._id).toString(),
          ),
        ];
        await blockedBy.save();
        const email = sinon.spy(emailService, 'sendConfirmContact');
        const { res } = await runHandler(res =>
          contactsController.add(
            {
              user: user1,
              body: { friendUserId: user2.id, message: 'A fictional request.' },
            },
            res,
          ),
        );
        res.statusCode.should.equal(403);
        (await Contact.countDocuments()).should.equal(0);
        email.called.should.be.false();
      });
    }
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
      res.body.confirmed!.should.be.false();
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
      res.body.message!.should.match(/email was sent/);
    });

    it('hides requests from a shadowbanned sender without saving a contact', async () => {
      user1.roles = ['user', 'shadowban'];
      await user1.save();

      const { res } = await runHandler(res =>
        contactsController.add(
          { user: user1, body: { friendUserId: user2._id.toString() } },
          res,
        ),
      );

      res.statusCode.should.equal(200);
      const contacts = await Contact.find({
        userFrom: user1._id,
        userTo: user2._id,
      });
      contacts.length.should.equal(0);
    });

    it('does not create a contact request for a shadowbanned recipient', async () => {
      user2.roles = ['user', 'shadowban'];
      await user2.save();

      const { res } = await runHandler(res =>
        contactsController.add(
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

    it('responds with 400 when the contact lookup fails before creation', async () => {
      sinon
        .stub(Contact, 'findOne')
        .returns(
          callbackQuery(new Error('lookup failed')) as unknown as ReturnType<
            typeof Contact.findOne
          >,
        );

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
      sinon
        .stub(emailService, 'sendConfirmContact')
        .callsArgWith(5, new Error('mail failed'));
      const controller = contactsController;

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
    it('responds with 403 when no contact was loaded', async () => {
      const { res } = await runHandler(res =>
        contactsController.confirm({ user: user2 }, res),
      );

      res.statusCode.should.equal(403);
    });

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

      const failSave = () => {
        return Promise.reject(new Error('save failed'));
      };
      sinon
        .stub(Contact.prototype, 'save')
        .callsFake(failSave as unknown as typeof Contact.prototype.save);

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
      res.body.confirmed!.should.be.true();
    });
  });

  describe('remove', () => {
    it('responds with 400 when removal fails', async () => {
      const contact = await new Contact({
        userFrom: user1._id,
        userTo: user2._id,
        confirmed: true,
      }).save();

      const failRemove = (callback: (error: Error) => void) => {
        callback(new Error('remove failed'));
      };
      sinon
        .stub(Contact.prototype, 'remove')
        .callsFake(failRemove as unknown as typeof Contact.prototype.remove);

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
      res.body.message!.should.equal('Contact removed.');
    });
  });

  describe('removeAllByUserId', () => {
    it('invokes the callback without error', done => {
      contactsController.removeAllByUserId(user1._id, (err: unknown) => {
        (err === null || err === undefined).should.be.true();
        done();
      });
    });

    it('allows callers to omit the callback', () => {
      type DeleteManyQuery = Pick<
        ReturnType<typeof Contact.deleteMany>,
        'exec'
      >;
      const model = Contact as unknown as {
        deleteMany: () => DeleteManyQuery;
      };
      const deleteMany = sinon.stub(model, 'deleteMany');
      deleteMany.returns({
        exec: () => Promise.resolve({ acknowledged: true, deletedCount: 0 }),
      });

      contactsController.removeAllByUserId(user1._id);

      deleteMany.calledOnce.should.be.true();
    });
  });

  describe('list and get', () => {
    it('returns the contacts list', async () => {
      const contacts = [{ user: { _id: new mongoose.Types.ObjectId() } }];
      const { res } = await runHandler(res =>
        contactsController.list({ contacts }, res),
      );
      res.body.should.deepEqual(contacts);
    });

    it('returns an empty object when no contacts list was loaded', async () => {
      const { res } = await runHandler(res => contactsController.list({}, res));
      res.body.should.deepEqual({});
    });

    it('returns a single contact', async () => {
      const contact = new Contact({
        userFrom: user1._id,
        userTo: user2._id,
      });
      const { res } = await runHandler(res =>
        contactsController.get({ contact }, res),
      );
      res.body._id!.should.equal(contact._id);
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
      const [privateUser] = await utils.saveUsersWithCachedPasswords(
        utils.generateUsersWithSharedPassword(1, { public: false }),
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
      sinon
        .stub(Contact, 'findOne')
        .returns(
          callbackQuery(
            new Error('contact lookup failed'),
          ) as unknown as ReturnType<typeof Contact.findOne>,
        );

      const { nextArg } = await runHandler((res, next) =>
        contactsController.contactByUserId(
          { user: user1 },
          res,
          next,
          user2._id.toString(),
        ),
      );
      should(nextArg).be.Error();
      should(nextArg).have.property('message', 'contact lookup failed');
    });

    it('attaches the contact and calls next', async () => {
      await new Contact({
        userFrom: user1._id,
        userTo: user2._id,
        confirmed: true,
      }).save();

      const req: { user: UserDocument; contact?: ContactDocument } = {
        user: user1,
      };
      const { nextCalled } = await runHandler((res, next) =>
        contactsController.contactByUserId(
          req,
          res,
          next,
          user2._id.toString(),
        ),
      );
      nextCalled.should.be.true();
      req.contact!.should.be.an.Object();
    });
  });

  describe('contactById', () => {
    it('rejects an invalid contact id', async () => {
      const { res } = await runHandler((res, next) =>
        contactsController.contactById({ user: user1 }, res, next, 'bad-id'),
      );
      res.statusCode.should.equal(400);
    });

    it('calls next without a public user', async () => {
      const [privateUser] = await utils.saveUsersWithCachedPasswords(
        utils.generateUsersWithSharedPassword(1, { public: false }),
      );
      const { nextCalled } = await runHandler((res, next) =>
        contactsController.contactById(
          { user: privateUser },
          res,
          next,
          new mongoose.Types.ObjectId().toString(),
        ),
      );

      nextCalled.should.be.true();
    });

    it('responds with 404 when no contact matches the id', async () => {
      const { res } = await runHandler((res, next) =>
        contactsController.contactById(
          { user: user1 },
          res,
          next,
          new mongoose.Types.ObjectId().toString(),
        ),
      );

      res.statusCode.should.equal(404);
    });

    it('responds with 404 for a contact the user does not belong to', async () => {
      const [stranger] = await utils.saveUsersWithCachedPasswords(
        utils.generateUsersWithSharedPassword(1, { public: true }),
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
      sinon
        .stub(Contact, 'findById')
        .returns(
          callbackQuery(
            new Error('contact id lookup failed'),
          ) as unknown as ReturnType<typeof Contact.findById>,
        );

      const { nextArg } = await runHandler((res, next) =>
        contactsController.contactById(
          { user: user1 },
          res,
          next,
          new mongoose.Types.ObjectId().toString(),
        ),
      );
      should(nextArg).be.Error();
      should(nextArg).have.property('message', 'contact id lookup failed');
    });

    it('attaches the contact for a participant', async () => {
      const contact = await new Contact({
        userFrom: user1._id,
        userTo: user2._id,
        confirmed: true,
      }).save();

      const req: { user: UserDocument; contact?: ContactDocument } = {
        user: user1,
      };
      const { nextCalled } = await runHandler((res, next) =>
        contactsController.contactById(req, res, next, contact._id.toString()),
      );
      nextCalled.should.be.true();
      req.contact!._id.toString().should.equal(contact._id.toString());
    });
  });

  describe('filterByCommon', () => {
    it('calls next when there are no contacts to filter', async () => {
      const req: { user: UserDocument; contacts: ContactRequestEntry[] } = {
        user: user1,
        contacts: [],
      };
      const { nextCalled } = await runHandler((res, next) =>
        contactsController.filterByCommon(req, res, next),
      );
      nextCalled.should.be.true();
    });

    it('returns an empty list when the user has no confirmed contacts', async () => {
      const req: { user: UserDocument; contacts: ContactRequestEntry[] } = {
        user: user1,
        contacts: [{ user: { _id: user2._id } }],
      };
      const { nextCalled } = await runHandler((res, next) =>
        contactsController.filterByCommon(req, res, next),
      );
      nextCalled.should.be.true();
      req.contacts!.length.should.equal(0);
    });

    it('calls next with a database error', async () => {
      sinon
        .stub(Contact, 'find')
        .returns(
          callbackQuery(new Error('find failed')) as unknown as ReturnType<
            typeof Contact.find
          >,
        );

      const req: { user: UserDocument; contacts: ContactRequestEntry[] } = {
        user: user1,
        contacts: [{ user: { _id: user2._id } }],
      };
      const { nextArg } = await runHandler((res, next) =>
        contactsController.filterByCommon(req, res, next),
      );
      should(nextArg).be.Error();
    });

    it('keeps only contacts shared with the authenticated user', async () => {
      const [user3] = await utils.saveUsersWithCachedPasswords(
        utils.generateUsersWithSharedPassword(1, { public: true }),
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

      const req: { user: UserDocument; contacts: ContactRequestEntry[] } = {
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
      req.contacts!.length.should.equal(2);
    });

    it('matches contacts when authenticated user is the receiving side', async () => {
      await new Contact({
        userFrom: user2._id,
        userTo: user1._id,
        confirmed: true,
      }).save();

      const req: { user: UserDocument; contacts: ContactRequestEntry[] } = {
        user: user1,
        contacts: [{ user: { _id: user2._id } }],
      };
      const { nextCalled } = await runHandler((res, next) =>
        contactsController.filterByCommon(req, res, next),
      );
      nextCalled.should.be.true();
      req.contacts!.length.should.equal(1);
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

      const req: { user: UserDocument; contacts?: ContactRequestEntry[] } = {
        user: user2,
      };
      const { nextCalled } = await runHandler((res, next) =>
        contactsController.contactListByUser(
          req,
          res,
          next,
          user1._id.toString(),
        ),
      );
      nextCalled.should.be.true();
      req.contacts!.length.should.equal(1);
    });

    it('omits existing contacts with restricted members', async () => {
      const [restrictedUser] = await utils.saveUsersWithCachedPasswords(
        utils.generateUsersWithSharedPassword(1, { public: true }),
      );
      restrictedUser.roles = ['user', 'shadowban'];
      await restrictedUser.save();
      await Contact.insertMany([
        {
          userFrom: user1._id,
          userTo: user2._id,
          confirmed: true,
        },
        {
          userFrom: user1._id,
          userTo: restrictedUser._id,
          confirmed: true,
        },
      ]);

      const req: { user: UserDocument; contacts?: ContactRequestEntry[] } = {
        user: user1,
      };
      const { nextCalled } = await runHandler((res, next) =>
        contactsController.contactListByUser(
          req,
          res,
          next,
          user1._id.toString(),
        ),
      );

      nextCalled.should.be.true();
      req.contacts!.should.have.length(1);
      req.contacts![0].user._id.toString().should.equal(user2._id.toString());
    });

    it('passes aggregate errors to next', async () => {
      sinon
        .stub(Contact, 'aggregate')
        .returns(
          callbackQuery(new Error('aggregate failed')) as unknown as ReturnType<
            typeof Contact.aggregate
          >,
        );

      const { nextArg } = await runHandler((res, next) =>
        contactsController.contactListByUser(
          { user: user1 },
          res,
          next,
          user2._id.toString(),
        ),
      );
      should(nextArg).be.Error();
      should(nextArg).have.property('message', 'aggregate failed');
    });

    it('passes missing aggregate results to next', async () => {
      sinon
        .stub(Contact, 'aggregate')
        .returns(
          callbackQuery(null, null) as unknown as ReturnType<
            typeof Contact.aggregate
          >,
        );

      const { nextArg } = await runHandler((res, next) =>
        contactsController.contactListByUser(
          { user: user1 },
          res,
          next,
          user2._id.toString(),
        ),
      );
      should(nextArg).be.Error();
      should(nextArg).have.property('message', 'Failed to load contacts.');
    });
  });
});
