const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');
const should: typeof import('should') = require('should');
const utils: typeof import('../../../../../testutils/server/data.server.testutil.mts') = require('../../../../../testutils/server/data.server.testutil.mts');
const rules: typeof import('../../../server/services/signup-review-rules.server.service.mts') = require('../../../server/services/signup-review-rules.server.service.mts');
const {
  matchSignupProfile,
}: typeof import('../../../server/services/signup-safety.server.service.mts') = require('../../../server/services/signup-safety.server.service.mts');
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
    should.equal(
      rules.normaliseReviewRules([
        { kind: 'keyword', value: 'x' },
        { kind: 'keyword', value: ' X ' },
      ]),
      null,
    );
    should.equal(
      rules.normaliseReviewRules(
        Array(501).fill({ kind: 'keyword', value: 'x' }),
      ),
      null,
    );
    should.equal(
      rules.normaliseReviewRules([{ kind: 'email', value: 'not-an-email' }]),
      null,
    );
    should.equal(
      rules.normaliseReviewRules([{ kind: 'domain', value: 'not a domain' }]),
      null,
    );
    should.equal(
      rules.normaliseReviewRules([{ kind: 'other', value: 'x' }]),
      null,
    );
    should.equal(
      rules.normaliseReviewRules([{ kind: 'keyword', value: '  ' }]),
      null,
    );
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

  it('falls back to built-in signup matching if saved rules cannot be loaded', async () => {
    sinon.stub(SignupReviewRules, 'findById').returns({
      lean: () => Promise.reject(new Error('Fictional storage failure')),
    } as unknown as ReturnType<typeof SignupReviewRules.findById>);
    const profile = { displayName: 'Fictional ordinary member' };
    const result = await rules.matchSignupReviewRules(profile);
    result.should.deepEqual(matchSignupProfile(profile));
  });
});
