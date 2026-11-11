import type {
  ContactModel,
  ContactRecord,
  Credentials,
  ExperienceModel,
  ExperienceRecord,
  OfferRecord,
  TestAgent,
  TestExpressApp,
  TestExpressModule,
  TribeDocument,
  TribeModel,
  TribeRecord,
  UserModelDocument,
  UserModel,
  UserRecord,
} from '../../../../testutils/server/model-contracts.mts';
const should: typeof import('should') = require('should');
const request: typeof import('supertest') = require('supertest');
const mongoose: typeof import('mongoose') = require('mongoose');
const express: TestExpressModule = require('./../../../../config/lib/express.mjs');
const utils: typeof import('../../../../testutils/server/data.server.testutil') = require('../../../../testutils/server/data.server.testutil');
const User = mongoose.model<UserRecord, UserModel>('User');
const Tribe = mongoose.model<TribeRecord, TribeModel>('Tribe');
const Contact = mongoose.model<ContactRecord, ContactModel>('Contact');
const Offer = mongoose.model<OfferRecord>('Offer');
const Experience = mongoose.model<ExperienceRecord, ExperienceModel>(
  'Experience',
);
/**
 * Globals
 */
let app: TestExpressApp;
let agent: TestAgent;
let credentials: Credentials;
let user: UserModelDocument;
let _user: UserRecord;
let tribe: TribeDocument;
let _tribe: TribeRecord;
let tribeNonPublic: TribeDocument;
let _tribeNonPublic: TribeRecord;
/**
 * User routes tests
 */
describe('Tribe CRUD tests', function () {
  before(function (done) {
    (async () => {
      // Get application
      app = await express.init(mongoose.connection);
      agent = request.agent(app);
      done();
    })().catch(done);
  });
  beforeEach(function (done) {
    // Create user credentials
    credentials = {
      username: 'trusername',
      password: 'M3@n.jsI$Aw3$0m3',
    };
    // Create a new user
    _user = {
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test@test.com',
      username: credentials.username,
      password: credentials.password,
      provider: 'local',
      public: true,
    };
    // Create a new tribe
    _tribe = {
      label: 'Awesome Tribe',
      attribution: 'Photo credits',
      attribution_url: 'http://www.trustroots.org/team',
      image: false,
      tribe: true,
      description: 'Lorem ipsum.',
    };
    // Create a new non-public tribe
    _tribeNonPublic = {
      label: 'Non-public Tribe',
      tribe: true,
      public: false,
    };
    user = new User(_user);
    tribe = new Tribe(_tribe);
    tribeNonPublic = new Tribe(_tribeNonPublic);
    // Save a user to the test db
    user
      .save()
      .then(() => {
        should.not.exist(null);
        tribe
          .save()
          .then(() => {
            should.not.exist(null);
            tribeNonPublic
              .save()
              .then(() => {
                should.not.exist(null);
                done(null);
              })
              .catch(done);
          })
          .catch(done);
      })
      .catch(done);
  });
  afterEach(utils.clearDatabase);
  it('formats stored descriptions consistently in catalogue and detail responses', async () => {
    tribe.description = [
      '<p>Sample <b>formatted</b> <a href="https://example.org/">linked</a> text</p>',
      '<a href="javascript:alert(1)">unsafe</a><iframe src="about:blank"></iframe>',
    ].join('');
    await tribe.save();
    const catalogue = await agent.get('/api/tribes').expect(200);
    const detail = await agent.get(`/api/tribes/${tribe.slug}`).expect(200);
    for (const circle of [catalogue.body[0], detail.body]) {
      circle.description.should.equal(
        '<p>Sample <b>formatted</b> <a href="https://example.org/">linked</a> text</p>',
      );
    }
  });
  it('builds catalogue page links with ordinary nested query fields', async () => {
    await new Tribe({
      label: 'Another Sample Circle',
    }).save();
    const response = await agent
      .get(
        '/api/tribes?limit=1&filter[label]=sample&filter[constructor][label]=unused',
      )
      .expect(200);
    response.headers.link.should.containEql('rel="next"');
    response.headers.link.should.not.containEql('constructor');
    response.body.should.have.length(1);
  });
  it('lists only recent, visible members of circles the viewer joined', async () => {
    user.member!.push({ tribe: tribe._id });
    await user.save();
    const createCandidate = (
      username: string,
      attributes: Partial<UserRecord> = {},
    ) =>
      new User({
        ..._user,
        username,
        email: `${username}@example.com`,
        displayName: `Member ${username}`,
        password: 'M3@n.jsI$Aw3$0m3',
        public: true,
        member: [{ tribe: tribe._id }],
        seen: new Date(),
        ...attributes,
      });
    const activeMember = createCandidate('activemember');
    const circleContact = createCandidate('circlecontact');
    const circleRecommender = createCandidate('circlerecommender');
    const oldMember = createCandidate('oldmember', {
      seen: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000),
    });
    const privateMember = createCandidate('privatemember', { public: false });
    const suspendedMember = createCandidate('suspendedmember', {
      roles: ['suspended'],
    });
    const blockedViewerMember = createCandidate('blockedviewermember', {
      blocked: [user._id],
    });
    await Promise.all([
      activeMember.save(),
      circleContact.save(),
      circleRecommender.save(),
      oldMember.save(),
      privateMember.save(),
      suspendedMember.save(),
      blockedViewerMember.save(),
    ]);
    await Contact.create(
      [circleContact, oldMember].map(contact => ({
        userFrom: user._id,
        userTo: contact._id,
        confirmed: true,
      })),
    );
    await Experience.create([
      {
        userFrom: circleRecommender._id,
        userTo: user._id,
        public: true,
        recommend: 'yes',
      },
      {
        userFrom: circleContact._id,
        userTo: user._id,
        public: true,
        recommend: 'yes',
      },
    ]);
    await Offer.collection.insertOne({
      user: circleContact._id,
      type: 'host',
      status: 'yes',
      location: [40, 6],
      locationFuzzy: [40.001, 6.001],
      showOnlyInMyCircles: true,
    });
    await agent.post('/api/auth/signin').send(credentials).expect(200);
    const response = await agent
      .get(`/api/tribes/${tribe.slug}/members`)
      .expect(200);
    response.body.contacts
      .map((member: { username: string }) => member.username)
      .should.deepEqual(['circlecontact', 'oldmember']);
    response.body.recommenders
      .map((member: { username: string }) => member.username)
      .should.deepEqual(['circlerecommender']);
    response.body.active
      .map((member: { username: string }) => member.username)
      .should.deepEqual(['activemember']);
    response.body.active[0].should.have.properties([
      '_id',
      'username',
      'displayName',
    ]);
    response.body.contacts[0].hosting.should.equal(true);
    response.body.contacts[0].activity.should.equal('today');
    response.body.contacts[1].activity.should.equal('older');
    should.not.exist(response.body.contacts[0].locationFuzzy);
    should.not.exist(response.body.active[0].seen);
  });
  it('lists recent connections separately from all visible hosting connections', async () => {
    await agent.get('/api/tribes/discovery/connections').expect(403);
    user.member!.push({ tribe: tribe._id });
    await user.save();
    const createConnection = (username: string, fields: Partial<UserRecord>) =>
      User.create({
        ..._user,
        username,
        email: `${username}@example.com`,
        ...fields,
      });
    const daysAgo = (days: number) =>
      new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const [newer, olderHost, restrictedHost, hidden, blocked, expired] =
      await Promise.all([
        createConnection('recentcontact', { seen: daysAgo(2) }),
        createConnection('olderhost', {
          seen: daysAgo(40),
          member: [{ tribe: tribe._id }],
        }),
        createConnection('restrictedhost', { seen: daysAgo(12) }),
        createConnection('hiddenhost', { public: false, seen: daysAgo(1) }),
        createConnection('blockedhost', {
          blocked: [user._id],
          seen: daysAgo(1),
        }),
        createConnection('expiredhost', { seen: daysAgo(40) }),
      ]);
    await Contact.create(
      [newer, olderHost, hidden, blocked, expired].map(connection => ({
        userFrom: connection._id,
        userTo: user._id,
        confirmed: true,
      })),
    );
    await Experience.create(
      [newer, restrictedHost].map(connection => ({
        userFrom: connection._id,
        userTo: user._id,
        public: true,
        recommend: 'yes' as const,
      })),
    );
    const approximate = [40.001, 6.001];
    await Offer.collection.insertMany(
      [olderHost, restrictedHost, hidden, blocked, expired].map(connection => ({
        user: connection._id,
        type: 'host',
        status: 'yes',
        location: [40, 6],
        locationFuzzy: approximate,
        updated: daysAgo(2),
        showOnlyInMyCircles: [olderHost, restrictedHost].includes(connection),
        ...(connection === expired && { validUntil: daysAgo(1) }),
      })),
    );
    await Offer.collection.insertOne({
      user: olderHost._id,
      type: 'host',
      status: 'maybe',
      location: [42, 6],
      locationFuzzy: [42.001, 6.001],
      updated: daysAgo(45),
    });
    await agent.post('/api/auth/signin').send(credentials).expect(200);
    const response = await agent
      .get('/api/tribes/discovery/connections')
      .expect(200);
    response.headers['cache-control'].should.equal('private, no-store');
    response.body.recent
      .map(({ username, activity }: { username: string; activity: string }) => [
        username,
        activity,
      ])
      .should.deepEqual([
        ['recentcontact', 'week'],
        ['restrictedhost', 'month'],
      ]);
    should.not.exist(response.body.recent[0].seen);
    response.body.hosts.should.deepEqual([
      {
        _id: olderHost._id.toString(),
        username: olderHost.username,
        displayName: olderHost.displayName,
        location: approximate,
      },
    ]);
  });
  it('filters contacts before applying the result limit and deduplicates pairs', async () => {
    user.member!.push({ tribe: tribe._id });
    await user.save();
    const candidates = Array.from({ length: 21 }, (_, index) => {
      const username = `unrelated${index.toString().padStart(2, '0')}`;
      return {
        ..._user,
        username,
        email: `${username}@example.com`,
        displayName: `A ${username}`,
        password: 'M3@n.jsI$Aw3$0m3',
        public: true,
        member: [],
      };
    });
    const eligibleFixture = {
      ..._user,
      username: 'eligiblecontact',
      email: 'eligible-contact@example.com',
      displayName: 'Z Eligible contact',
      password: 'M3@n.jsI$Aw3$0m3',
      public: true,
      member: [{ tribe: tribe._id }],
    };
    const [eligibleContact, ...savedCandidates] =
      await utils.saveUsersWithCachedPasswords([
        eligibleFixture,
        ...candidates,
      ]);
    await Contact.create([
      ...savedCandidates.map(candidate => ({
        userFrom: user._id,
        userTo: candidate._id,
        confirmed: true,
      })),
      {
        userFrom: user._id,
        userTo: eligibleContact._id,
        confirmed: true,
      },
      {
        userFrom: eligibleContact._id,
        userTo: user._id,
        confirmed: true,
      },
    ]);
    await agent.post('/api/auth/signin').send(credentials).expect(200);
    const response = await agent
      .get(`/api/tribes/${tribe.slug}/members`)
      .expect(200);
    response.body.contacts
      .map((member: { username: string }) => member.username)
      .should.deepEqual(['eligiblecontact']);
  });

  const circleFixture = (
    username: string,
    attributes: Partial<UserRecord> & Record<string, unknown> = {},
  ) => ({
    ..._user,
    username,
    email: `${username}@example.com`,
    displayName: `Member ${username}`,
    password: 'M3@n.jsI$Aw3$0m3',
    public: true,
    member: [{ tribe: tribe._id }],
    seen: new Date(),
    ...attributes,
  });
  const usernames = (members: { username: string }[]) =>
    members.map(member => member.username);

  it('lists confirmed contacts in either direction ordered by name', async () => {
    user.member!.push({ tribe: tribe._id });
    await user.save();
    const [fromViewer, toViewer, unconfirmed, otherA, otherB] =
      await utils.saveUsersWithCachedPasswords([
        circleFixture('fromviewer', { displayName: 'A From viewer' }),
        circleFixture('toviewer', { displayName: 'B To viewer' }),
        circleFixture('unconfirmed'),
        circleFixture('othera'),
        circleFixture('otherb'),
      ]);
    await Contact.create([
      { userFrom: user._id, userTo: fromViewer._id, confirmed: true },
      { userFrom: toViewer._id, userTo: user._id, confirmed: true },
      { userFrom: user._id, userTo: unconfirmed._id, confirmed: false },
      { userFrom: otherA._id, userTo: otherB._id, confirmed: true },
    ]);
    await agent.post('/api/auth/signin').send(credentials).expect(200);
    const response = await agent
      .get(`/api/tribes/${tribe.slug}/members`)
      .expect(200);
    usernames(response.body.contacts).should.deepEqual([
      'fromviewer',
      'toviewer',
    ]);
  });

  it('lists only public recommending experiences, newest first', async () => {
    user.member!.push({ tribe: tribe._id });
    await user.save();
    const [older, newer, notRecommending, privateExperience, forOther, other] =
      await utils.saveUsersWithCachedPasswords([
        circleFixture('older'),
        circleFixture('newer'),
        circleFixture('notrecommending'),
        circleFixture('privateexperience'),
        circleFixture('forother'),
        circleFixture('other'),
      ]);
    await Experience.create([
      {
        userFrom: older._id,
        userTo: user._id,
        public: true,
        recommend: 'yes',
        created: new Date('2021-01-01'),
      },
      {
        userFrom: newer._id,
        userTo: user._id,
        public: true,
        recommend: 'yes',
        created: new Date('2024-01-01'),
      },
      {
        userFrom: notRecommending._id,
        userTo: user._id,
        public: true,
        recommend: 'no',
      },
      {
        userFrom: privateExperience._id,
        userTo: user._id,
        public: false,
        recommend: 'yes',
      },
      {
        userFrom: forOther._id,
        userTo: other._id,
        public: true,
        recommend: 'yes',
      },
    ]);
    await agent.post('/api/auth/signin').send(credentials).expect(200);
    const response = await agent
      .get(`/api/tribes/${tribe.slug}/members`)
      .expect(200);
    usernames(response.body.recommenders).should.deepEqual(['newer', 'older']);
  });

  it('limits active members to the eight most recently seen', async () => {
    user.member!.push({ tribe: tribe._id });
    await user.save();
    const now = Date.now();
    // Saved oldest first so insertion order differs from the expected order.
    await utils.saveUsersWithCachedPasswords(
      Array.from({ length: 9 }, (_, index) =>
        circleFixture(`active${index}`, {
          seen: new Date(now - (9 - index) * 60 * 1000),
        }),
      ),
    );
    await agent.post('/api/auth/signin').send(credentials).expect(200);
    const response = await agent
      .get(`/api/tribes/${tribe.slug}/members`)
      .expect(200);
    usernames(response.body.active).should.deepEqual([
      'active8',
      'active7',
      'active6',
      'active5',
      'active4',
      'active3',
      'active2',
      'active1',
    ]);
  });

  it('does not serve non-public circles by slug', async () => {
    await agent.post('/api/auth/signin').send(credentials).expect(200);
    const response = await agent.get(`/api/tribes/${tribeNonPublic.slug}`);
    response.body.should.not.have.property('label');
  });

  it('requires circle membership to list active members', async () => {
    await agent.post('/api/auth/signin').send(credentials).expect(200);
    await agent.get(`/api/tribes/${tribe.slug}/members`).expect(403);
  });
  it('should be able to read tribes when logged in', function (done) {
    agent
      .post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) return done(signinErr);
        // Read tribes
        agent
          .get('/api/tribes')
          .expect(200)
          .end(function (tribesReadErr, tribesReadRes) {
            tribesReadRes.body.should.have.length(1);
            tribesReadRes.body[0].label.should.equal('Awesome Tribe');
            tribesReadRes.body[0].slug.should.equal('awesome-tribe');
            tribesReadRes.body[0].description.should.equal(_tribe.description);
            tribesReadRes.body[0].attribution.should.equal(_tribe.attribution);
            tribesReadRes.body[0].attribution_url.should.equal(
              _tribe.attribution_url,
            );
            tribesReadRes.body[0].new.should.equal(true); // Virtual field
            tribesReadRes.body[0].count.should.eql(0);
            should.exist(tribesReadRes.body[0].created);
            should.exist(tribesReadRes.body[0]._id);
            // `color` and `image` are published only for tribes
            should.exist(tribesReadRes.body[0].color);
            tribesReadRes.body[0].image.should.equal(_tribe.image);
            // These are at the model, but aren't exposed
            should.not.exist(tribesReadRes.body[0].synonyms);
            should.not.exist(tribesReadRes.body[0].labelHistory);
            should.not.exist(tribesReadRes.body[0].slugHistory);
            // Call the assertion callback
            return done(tribesReadErr);
          });
      });
  });
  it('should be able to read only 2 most popular tribes from page 1', function (done) {
    // Create more tribes
    const tribe1 = new Tribe(_tribe);
    tribe1.label = 'Tribe 1';
    tribe1.count = 50;
    tribe1
      .save()
      .then(() => {
        should.not.exist(null);
        const tribe2 = new Tribe(_tribe);
        tribe2.label = 'Tribe 2';
        tribe2.count = 40;
        tribe2
          .save()
          .then(() => {
            should.not.exist(null);
            const tribe3 = new Tribe(_tribe);
            tribe3.label = 'Tribe 3';
            tribe3.count = 30;
            tribe3
              .save()
              .then(() => {
                should.not.exist(null);
                const tribe4 = new Tribe(_tribe);
                tribe4.label = 'Tribe 4';
                tribe4.count = 20;
                tribe4
                  .save()
                  .then(() => {
                    should.not.exist(null);
                    // Read tribes
                    agent
                      .get('/api/tribes?limit=2') // defaults to `&page=1`
                      .expect(200)
                      .end(function (tribesReadErr, tribesReadRes) {
                        tribesReadRes.body.should.have.length(2);
                        tribesReadRes.body[0].label.should.equal('Tribe 1');
                        tribesReadRes.body[1].label.should.equal('Tribe 2');
                        // Call the assertion callback
                        return done(tribesReadErr);
                      });
                  })
                  .catch(done);
              })
              .catch(done);
          })
          .catch(done);
      })
      .catch(done);
  });
  it('should be able to read most popular tribes from page 2', function (done) {
    // Create more tribes
    const tribe1 = new Tribe(_tribe);
    tribe1.label = 'Tribe 1';
    tribe1.count = 50;
    tribe1
      .save()
      .then(() => {
        should.not.exist(null);
        const tribe2 = new Tribe(_tribe);
        tribe2.label = 'Tribe 2';
        tribe2.count = 40;
        tribe2
          .save()
          .then(() => {
            should.not.exist(null);
            const tribe3 = new Tribe(_tribe);
            tribe3.label = 'Tribe 3';
            tribe3.count = 30;
            tribe3
              .save()
              .then(() => {
                should.not.exist(null);
                const tribe4 = new Tribe(_tribe);
                tribe4.label = 'Tribe 4';
                tribe4.count = 20;
                tribe4
                  .save()
                  .then(() => {
                    should.not.exist(null);
                    // Read tribes
                    agent
                      .get('/api/tribes?limit=2&page=2')
                      .expect(200)
                      .end(function (tribesReadErr, tribesReadRes) {
                        tribesReadRes.body.should.have.length(2);
                        tribesReadRes.body[0].label.should.equal('Tribe 3');
                        tribesReadRes.body[1].label.should.equal('Tribe 4');
                        // Call the assertion callback
                        return done(tribesReadErr);
                      });
                  })
                  .catch(done);
              })
              .catch(done);
          })
          .catch(done);
      })
      .catch(done);
  });
});
