/**
 * Unit tests for the admin notes controller.
 */
const mongoose: typeof import('mongoose') = require('mongoose');
const sinon = require('sinon');

type NotesController =
  typeof import('../../server/controllers/admin.notes.server.controller.mts');
const adminNotes: Pick<
  NotesController,
  'addNote' | 'getNotes'
> = require('./../../server/controllers/admin.notes.server.controller.mts');
const errorService: typeof import('../../../core/server/services/error.server.service.mjs') = require('./../../../core/server/services/error.server.service.mjs');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil.mts');
const should: typeof import('should') = require('should');

type AdminNoteRecord = {
  admin: import('mongoose').Types.ObjectId;
  user: import('mongoose').Types.ObjectId;
  note: string;
  date?: Date;
};
const AdminNote = mongoose.model<AdminNoteRecord>('AdminNote');
type MockResponse = {
  statusCode: number;
  body: unknown;
  status(code: number): MockResponse;
  send(body: unknown): MockResponse;
  waitForResponse(): Promise<MockResponse>;
};
type CallbackQuery<T> = {
  sort(...args: unknown[]): CallbackQuery<T>;
  populate(...args: unknown[]): CallbackQuery<T>;
  exec(callback: (error: Error | null, result: T | null) => void): void;
};

function queryBody(response: MockResponse): Record<string, unknown> {
  if (typeof response.body !== 'object' || response.body === null) {
    throw new Error('Expected an object response body');
  }
  return Object.fromEntries(Object.entries(response.body));
}

function mockResponse(): MockResponse {
  let resolveResponse: (response: MockResponse) => void = () => {
    throw new Error('Response completion has not been initialised');
  };
  const promise = new Promise<MockResponse>(resolve => {
    resolveResponse = resolve;
  });
  const res: MockResponse = {
    statusCode: 200,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    send(body) {
      res.body = body;
      resolveResponse(res);
      return res;
    },
    waitForResponse: () => promise,
  };
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
      should(queryBody(res).message).equal('Empty note.');
    });

    it('rejects invalid user ids', async () => {
      for (const userId of ['not-an-object-id', {}]) {
        const res = mockResponse();
        await adminNotes.addNote(
          {
            body: { userId, note: 'test' },
            user: { _id: 'admin' },
          },
          res,
        );

        res.statusCode.should.equal(400);
        should(queryBody(res).message).equal(
          errorService.getErrorMessageByKey('invalid-id'),
        );
      }
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

      should(queryBody(res).message).equal('Note saved.');

      const saved = await AdminNote.findOne({ user: target._id }).exec();
      if (!saved) throw new Error('Expected saved admin note');
      saved.note.should.not.containEql('script');
      saved.admin.toString().should.equal(admin._id.toString());
    });

    it('accepts ObjectId-like values supported by Mongoose', async () => {
      const users = await utils.saveUsers(utils.generateUsers(2));
      const targetId = new mongoose.Types.ObjectId(users[1]._id.toString());
      const res = mockResponse();
      await adminNotes.addNote(
        {
          body: {
            userId: {
              id: targetId.id,
              toHexString: () => targetId.toHexString(),
            },
            note: 'Fictional note',
          },
          user: users[0],
        },
        res,
      );
      res.statusCode.should.equal(400);
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
      should(queryBody(res).message).equal(
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

      if (!Array.isArray(res.body)) throw new Error('Expected notes array');
      res.body.length.should.equal(1);
      should(res.body[0].note).equal('<p>saved note</p>');
      should(res.body[0].admin.username).equal(admin.username);
    });

    it('returns an empty array when a user has no notes', async () => {
      const users = await utils.saveUsers(utils.generateUsers(1));

      const res = mockResponse();
      adminNotes.getNotes({ query: { userId: users[0]._id.toString() } }, res);
      await res.waitForResponse();

      should(res.body).eql([]);
    });

    it('returns an empty array when note lookup returns null', async () => {
      const nullQuery: CallbackQuery<AdminNoteRecord[]> = {
        sort: () => nullQuery,
        populate: () => nullQuery,
        exec: () => Promise.resolve(null),
      };
      sinon
        .stub(AdminNote, 'find')
        .returns(nullQuery as unknown as ReturnType<typeof AdminNote.find>);

      const res = mockResponse();
      adminNotes.getNotes(
        { query: { userId: new mongoose.Types.ObjectId().toString() } },
        res,
      );
      await res.waitForResponse();

      should(res.body).eql([]);
    });

    it('returns 400 when note lookup fails', async () => {
      const errorQuery: CallbackQuery<AdminNoteRecord[]> = {
        sort: () => errorQuery,
        populate: () => errorQuery,
        exec: () => Promise.reject(new Error('lookup failed')),
      };
      sinon
        .stub(AdminNote, 'find')
        .returns(errorQuery as unknown as ReturnType<typeof AdminNote.find>);

      const res = mockResponse();
      adminNotes.getNotes(
        { query: { userId: new mongoose.Types.ObjectId().toString() } },
        res,
      );
      const response = await res.waitForResponse();
      response.statusCode.should.equal(400);
    });
  });

  describe('user id inputs and listing', () => {
    async function getNotesFor(userId: unknown): Promise<MockResponse> {
      const res = mockResponse();
      await adminNotes.getNotes({ query: { userId } }, res);
      return res;
    }

    function expectInvalidId(res: MockResponse): void {
      res.statusCode.should.equal(400);
      should(res.body).deepEqual({
        message: errorService.getErrorMessageByKey('invalid-id'),
      });
    }

    it('looks up notes by ObjectId-like values with a string or Buffer id', async () => {
      const target = new mongoose.Types.ObjectId();
      await AdminNote.create({
        admin: new mongoose.Types.ObjectId(),
        user: target,
        note: 'Fictional note',
      });

      for (const id of [
        target.toHexString().slice(0, 12),
        Buffer.from(target.id),
      ]) {
        const res = await getNotesFor({
          id,
          toHexString: () => target.toHexString(),
        });
        res.statusCode.should.equal(200);
        (res.body as unknown[]).length.should.equal(1);
      }
    });

    it('rejects objects that are not ObjectId-like or not ids at all', async () => {
      const target = new mongoose.Types.ObjectId();
      const toHexString = () => target.toHexString();
      const inputs: unknown[] = [
        null,
        12,
        { id: Buffer.from(target.id) },
        { id: Buffer.from(target.id), toHexString: 'not a function' },
        { id: new Uint8Array(target.id), toHexString },
      ];
      for (const userId of inputs) {
        expectInvalidId(await getNotesFor(userId));
      }
    });

    it('rejects notes that are missing or not text', async () => {
      for (const note of [undefined, 5]) {
        const res = mockResponse();
        await adminNotes.addNote(
          { body: { userId: new mongoose.Types.ObjectId(), note } },
          res,
        );
        res.statusCode.should.equal(400);
        should(res.body).deepEqual({ message: 'Empty note.' });
      }
    });

    it("lists only the user's notes, newest first, with the admin's username", async () => {
      const [admin] = await utils.saveUsersWithCachedPasswords(
        utils.generateUsersWithSharedPassword(1),
      );
      const target = new mongoose.Types.ObjectId();
      await AdminNote.create(
        (
          [
            [target, 'older'],
            [new mongoose.Types.ObjectId(), 'other user'],
            [target, 'newer'],
          ] as const
        ).map(([user, note], day) => ({
          admin: admin._id,
          user,
          note,
          date: new Date(Date.UTC(2026, 0, day + 1)),
        })),
      );

      const res = await getNotesFor(target.toString());

      const notes = JSON.parse(JSON.stringify(res.body)) as Array<{
        note: string;
        admin: unknown;
      }>;
      notes.map(item => item.note).should.deepEqual(['newer', 'older']);
      should(notes[0].admin).deepEqual({
        _id: admin._id.toString(),
        username: admin.username,
      });
    });
  });
});
