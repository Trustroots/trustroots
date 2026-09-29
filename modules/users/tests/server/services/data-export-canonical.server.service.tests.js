require('should');

const canonical = require('../../../server/services/data-export-canonical.server.service');

describe('Member data export canonicalisation', () => {
  describe('canonicalise', () => {
    it('sorts object keys by UTF-16 code unit', () => {
      canonical
        .canonicalise({ b: 1, a: 2, A: 3, ä: 4, '': 5 })
        .should.equal('{"":5,"A":3,"a":2,"b":1,"ä":4}');
    });

    it('preserves array order', () => {
      canonical.canonicalise([3, 1, 2]).should.equal('[3,1,2]');
    });

    it('emits no insignificant whitespace', () => {
      canonical
        .canonicalise({ a: [1, { b: 'c' }] })
        .should.equal('{"a":[1,{"b":"c"}]}');
    });

    it('serialises literals the way JSON does', () => {
      canonical
        .canonicalise({ n: null, t: true, f: false, s: 'a"b\n' })
        .should.equal('{"f":false,"n":null,"s":"a\\"b\\n","t":true}');
    });

    it('serialises numbers with ECMAScript number-to-string', () => {
      canonical
        .canonicalise({ a: 1e21, b: -0, c: 1.5 })
        .should.equal('{"a":1e+21,"b":0,"c":1.5}');
    });

    it('drops object members whose value is not representable', () => {
      canonical
        .canonicalise({ a: 1, b: undefined, c: () => {} })
        .should.equal('{"a":1}');
    });

    it('represents unrepresentable array items as null', () => {
      canonical.canonicalise([1, undefined, 2]).should.equal('[1,null,2]');
    });

    it('refuses non-finite numbers rather than silently emitting null', () => {
      (() => canonical.canonicalise({ a: NaN })).should.throw(
        /non-finite number/,
      );
      (() => canonical.canonicalise({ a: Infinity })).should.throw(
        /non-finite number/,
      );
    });

    it('refuses a top-level value that is not representable', () => {
      (() => canonical.canonicalise(undefined)).should.throw(
        /not representable/,
      );
    });
  });

  describe('toPlainJson', () => {
    it('unwraps documents that expose toJSON', () => {
      const document = {
        toJSON() {
          return { username: 'member' };
        },
      };
      canonical.toPlainJson(document).should.deepEqual({ username: 'member' });
    });

    it('renders dates as ISO 8601 strings', () => {
      canonical
        .toPlainJson({ created: new Date('2020-01-02T03:04:05.000Z') })
        .should.deepEqual({ created: '2020-01-02T03:04:05.000Z' });
    });
  });

  describe('buildSignedPayload', () => {
    const profile = { username: 'member', displayName: 'Member Example' };

    it('orders list sections deterministically regardless of source order', () => {
      const forwards = canonical.buildSignedPayload({
        profile,
        contacts: [{ _id: 'b' }, { _id: 'a' }],
        hostingOffers: [{ _id: 'y' }, { _id: 'x' }],
      });
      const backwards = canonical.buildSignedPayload({
        profile,
        contacts: [{ _id: 'a' }, { _id: 'b' }],
        hostingOffers: [{ _id: 'x' }, { _id: 'y' }],
      });

      canonical
        .canonicalise(forwards)
        .should.equal(canonical.canonicalise(backwards));
      forwards.contacts.should.deepEqual([{ _id: 'a' }, { _id: 'b' }]);
    });

    it('orders items without an identifier by their canonical form', () => {
      const payload = canonical.buildSignedPayload({
        profile,
        contacts: [{ z: 1 }, { a: 1 }],
        hostingOffers: [],
      });

      payload.contacts.should.deepEqual([{ a: 1 }, { z: 1 }]);
    });

    it('keeps duplicate items in a stable, canonical order', () => {
      const payload = canonical.buildSignedPayload({
        profile,
        contacts: [
          { _id: 'a', n: 2 },
          { _id: 'a', n: 1 },
          { _id: 'a', n: 2 },
        ],
        hostingOffers: [null, null],
      });

      payload.contacts.should.deepEqual([
        { _id: 'a', n: 1 },
        { _id: 'a', n: 2 },
        { _id: 'a', n: 2 },
      ]);
      payload.hostingOffers.should.deepEqual([null, null]);
    });

    it('carries the format and version but never request-time metadata', () => {
      const payload = canonical.buildSignedPayload({
        profile,
        contacts: [],
        hostingOffers: [],
        exportedAt: '2026-09-05T00:00:00.000Z',
      });

      payload.should.have.properties(['format', 'version']);
      payload.should.not.have.property('exportedAt');
      payload.should.not.have.property('signature');
    });

    it('defaults missing sections to empty values', () => {
      const payload = canonical.buildSignedPayload();

      payload.profile.should.deepEqual({});
      payload.contacts.should.deepEqual([]);
      payload.hostingOffers.should.deepEqual([]);
    });
  });

  describe('digestPayload', () => {
    const payload = canonical.buildSignedPayload({
      profile: { username: 'member' },
      contacts: [{ _id: 'a' }],
      hostingOffers: [],
    });

    it('produces a hex SHA-256 digest per section plus a root', () => {
      const digests = canonical.digestPayload(payload);

      digests.sections.should.have.properties([
        'profile',
        'contacts',
        'hostingOffers',
      ]);
      Object.values(digests.sections).forEach(digest =>
        digest.should.match(/^[0-9a-f]{64}$/),
      );
      digests.root.should.match(/^[0-9a-f]{64}$/);
    });

    it('is stable across repeated exports of unchanged data', () => {
      canonical
        .digestPayload(payload)
        .should.deepEqual(canonical.digestPayload(payload));
    });

    it('changes the affected section digest and the root when data changes', () => {
      const before = canonical.digestPayload(payload);
      const after = canonical.digestPayload(
        canonical.buildSignedPayload({
          profile: { username: 'member' },
          contacts: [{ _id: 'b' }],
          hostingOffers: [],
        }),
      );

      after.sections.contacts.should.not.equal(before.sections.contacts);
      after.sections.profile.should.equal(before.sections.profile);
      after.root.should.not.equal(before.root);
    });

    it('binds the format and version into the root', () => {
      const tampered = { ...payload, version: 99 };

      canonical
        .digestPayload(tampered)
        .root.should.not.equal(canonical.digestPayload(payload).root);
    });
  });
});
