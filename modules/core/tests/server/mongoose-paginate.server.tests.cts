const should: typeof import('should') = require('should');
const mongoose: typeof import('mongoose') = require('mongoose');
const mongoosePaginate: typeof import('../../../../config/lib/mongoose-paginate.mts') = require('../../../../config/lib/mongoose-paginate.mjs');

interface PaginatedRecord {
  name?: string;
  order: number;
  _id: import('mongoose').Types.ObjectId;
  id?: string;
}
type PageResult =
  import('../../../../config/lib/mongoose-paginate.mts').PaginateResult<PaginatedRecord>;
type PageCallback = (error: unknown, result?: PageResult) => void;
type PaginatedModel = import('mongoose').Model<PaginatedRecord> & {
  paginate(
    query: Record<string, unknown>,
    options: Record<string, unknown>,
    callback?: PageCallback,
  ): Promise<PageResult>;
};

describe('Mongoose paginate plugin', function () {
  const schema = new mongoose.Schema<PaginatedRecord>({
    name: String,
    order: Number,
  });
  schema.plugin(mongoosePaginate.default);
  const Paginated = mongoose.model<PaginatedRecord, PaginatedModel>(
    'PaginatePluginTest',
    schema,
  );

  beforeEach(async function () {
    await Paginated.deleteMany({});
    await Paginated.create(
      [1, 2, 3, 4, 5].map(order => ({ name: `item ${order}`, order })),
    );
  });

  afterEach(async function () {
    await Paginated.deleteMany({});
  });

  it('returns the first page by default', async function () {
    const result = await Paginated.paginate({}, { sort: 'order', limit: 2 });

    result.docs.map(doc => doc.order).should.eql([1, 2]);
    result.total.should.equal(5);
    result.limit.should.equal(2);
    should(result.offset).equal(0);
    should(result.page).equal(1);
    should(result.pages).equal(3);
  });

  it('supports page and select options', async function () {
    const result = await Paginated.paginate(
      {},
      { sort: 'order', limit: 2, page: 3, select: 'order' },
    );

    result.docs.map(doc => doc.order).should.eql([5]);
    should.not.exist(result.docs[0].name);
    should(result.page).equal(3);
    should.not.exist(result.offset);
  });

  it('supports offset instead of page', async function () {
    const result = await Paginated.paginate(
      { order: { $gt: 1 } },
      { sort: 'order', limit: 2, offset: 1 },
    );

    result.docs.map(doc => doc.order).should.eql([3, 4]);
    result.total.should.equal(4);
    should(result.offset).equal(1);
    should.not.exist(result.page);
  });

  it('returns only the total when limit is 0', async function () {
    const result = await Paginated.paginate({}, { limit: 0 });

    result.docs.should.eql([]);
    result.total.should.equal(5);
  });

  it('adds ids to lean documents and populates', async function () {
    const result = await Paginated.paginate(
      {},
      { sort: 'order', limit: 1, lean: true, populate: [] },
    );

    should(result.docs[0].id).equal(String(result.docs[0]._id));
  });

  it('can skip ids on lean documents', async function () {
    const result = await Paginated.paginate(
      {},
      { limit: 1, lean: true, leanWithId: false },
    );

    should.not.exist(result.docs[0].id);
  });

  it('calls the callback with the result', function (done) {
    Paginated.paginate({}, { limit: 1 }, (error, result) => {
      should.not.exist(error);
      if (!result) return done(new Error('Expected a pagination result'));
      result.total.should.equal(5);
      done();
    });
  });

  it('calls the callback with errors', function (done) {
    Paginated.paginate({ order: { $badOperator: 1 } }, {}, error => {
      should.exist(error);
      done();
    });
  });
});
