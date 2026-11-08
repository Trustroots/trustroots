const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');
const should: typeof import('should') = require('should');
const utils: typeof import('../../../../../testutils/server/data.server.testutil.mts') = require('../../../../../testutils/server/data.server.testutil.mts');
const rules: typeof import('../../../server/services/signup-review-rules.server.service.mts') = require('../../../server/services/signup-review-rules.server.service.mts');
const {
  matchSignupProfile,
}: typeof import('../../../server/services/signup-safety.server.service.mts') = require('../../../server/services/signup-safety.server.service.mts');
const mockModule: typeof import('../../../../../testutils/server/mock-module.mts').default = require('../../../../../testutils/server/mock-module');
const SignupReviewRules = mongoose.model('SignupReviewRules');

describe('Signup review rules service', () => {
  afterEach(() => {
    sinon.restore();
    return utils.clearDatabase();
  });

  it('normalises rules and rejects invalid or duplicate entries', () => {
    rules
      .normaliseReviewRules([
        { kind: 'keyword', value: ' Fictional Phrase ' },
        { kind: 'email', value: ' Person@Example.test ' },
        { kind: 'domain', value: ' Example.test ' },
      ])!
      .should.deepEqual([
        { kind: 'keyword', value: 'fictional phrase' },
        { kind: 'email', value: 'person@example.test' },
        { kind: 'domain', value: 'example.test' },
      ]);
    const keywords = (count: number) =>
      Array.from({ length: count }, (_, i) => ({
        kind: 'keyword',
        value: `k${i}`,
      }));
    rules.normaliseReviewRules(keywords(500))!.should.have.length(500);
    rules
      .normaliseReviewRules([{ kind: 'keyword', value: 'x'.repeat(254) }])!
      .should.have.length(1);
    for (const invalid of [
      [
        { kind: 'keyword', value: 'x' },
        { kind: 'keyword', value: ' X ' },
      ],
      keywords(501),
      [null],
      [Object.assign(() => {}, { kind: 'keyword', value: 'x' })],
      [{ kind: 'keyword', value: 5 }],
      [{ kind: 'keyword', value: 'x'.repeat(255) }],
      [{ kind: 'keyword', value: 'a\u0001' }],
      [{ kind: 'keyword', value: 'a\u007f' }],
      [{ kind: 'email', value: 'not-an-email' }],
      [{ kind: 'domain', value: 'not a domain' }],
      [{ kind: 'other', value: 'x' }],
      [{ kind: 'keyword', value: '  ' }],
    ])
      should.equal(rules.normaliseReviewRules(invalid), null);
  });

  it('matches profile keywords, exact email addresses and exact domains', () => {
    const configured = rules.normaliseReviewRules([
      { kind: 'keyword', value: 'fictional' },
      { kind: 'email', value: 'person@example.test' },
      { kind: 'domain', value: 'example.test' },
    ])!;
    rules
      .matchReviewRules(
        { displayName: 'A Fictional Person', email: 'Person@Example.test' },
        configured,
      )
      .should.deepEqual([
        'keyword: fictional',
        'email: person@example.test',
        'domain: example.test',
      ]);
    rules
      .matchReviewRules(
        { displayName: 'Person', email: 'other@example.test' },
        configured,
      )
      .should.deepEqual(['domain: example.test']);
    rules
      .matchReviewRules({ email: ' person@example.test ' }, configured)
      .should.deepEqual(['email: person@example.test', 'domain: example.test']);
    rules
      .matchReviewRules(
        { firstName: 'Fic', lastName: 'tional', email: 'x@other.test' },
        configured,
      )
      .should.deepEqual([]);
  });

  it('matches a signup against the persisted review rules', async () => {
    await SignupReviewRules.create({
      _id: rules.RULES_ID,
      revision: 1,
      rules: [{ kind: 'keyword', value: 'fictional' }],
    });
    (
      await rules.matchSignupReviewRules({ displayName: 'A Fictional Member' })
    ).should.deepEqual(['keyword: fictional']);
  });

  it('uses built-in keyword rules when no saved rules exist', async () => {
    const loaded = await rules.getReviewRules();
    loaded.revision.should.equal(0);
    loaded.rules.length.should.be.greaterThan(0);
    loaded.rules.every(rule => rule.kind === 'keyword').should.equal(true);
  });

  it('logs and falls back to built-in signup matching if saved rules cannot be loaded', async () => {
    const error = new Error('Fictional storage failure');
    const findById = sinon.stub(SignupReviewRules, 'findById').returns({
      lean: () => Promise.reject(error),
    } as unknown as ReturnType<typeof SignupReviewRules.findById>);
    const logs: unknown[][] = [];
    const service = mockModule<typeof rules>(
      require.resolve('../../../server/services/signup-review-rules.server.service.mts'),
      {
        '../../../../config/lib/logger.mjs': (...args: unknown[]) =>
          logs.push(args),
      },
    );
    const profile = { displayName: 'Fictional ordinary member' };
    const result = await service.matchSignupReviewRules(profile);
    result.should.deepEqual(matchSignupProfile(profile));
    findById.calledOnceWithExactly('signup-review').should.be.true();
    logs.should.deepEqual([
      ['error', 'Signup review rules could not be loaded.', { error }],
    ]);
  });
});
