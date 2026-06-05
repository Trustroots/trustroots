/**
 * Unit tests for tribes controller list and middleware branches.
 */
const mongoose = require('mongoose');

const tribesController = require('../../server/controllers/tribes.server.controller');
const utils = require('../../../../testutils/server/data.server.testutil');
require('should');

const Tribe = mongoose.model('Tribe');

function deferredResponse() {
  let resolveResponse;
  const promise = new Promise(resolve => {
    resolveResponse = resolve;
  });
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
    locals: {
      url: '/api/tribes/',
      paginate: { href: query => `?page=${query.page}` },
    },
  };
  res.status = code => {
    res.statusCode = code;
    return res;
  };
  res.send = body => {
    res.body = body;
    resolveResponse(res);
    return res;
  };
  res.json = body => {
    res.body = body;
    resolveResponse(res);
    return res;
  };
  res.set = (key, value) => {
    res.headers[key] = value;
    return res;
  };
  res.waitForResponse = () => promise;
  return res;
}

describe('Tribes controller unit tests', () => {
  afterEach(utils.clearDatabase);

  describe('listTribes', () => {
    it('returns public tribes sorted by count', async () => {
      await new Tribe({
        label: 'Alpha',
        slug: 'alpha',
        public: true,
        count: 1,
      }).save();
      await new Tribe({
        label: 'Beta',
        slug: 'beta',
        public: true,
        count: 5,
      }).save();

      const res = deferredResponse();
      tribesController.listTribes(
        { query: {}, protocol: 'https', originalUrl: '/api/tribes' },
        res,
      );
      await res.waitForResponse();
      res.body.should.be.an.Array().with.lengthOf(2);
      res.body[0].slug.should.equal('beta');
    });

    it('sorts tribes alphabetically when requested', async () => {
      await new Tribe({
        label: 'Zulu',
        slug: 'zulu',
        public: true,
        count: 1,
      }).save();
      await new Tribe({
        label: 'Alpha',
        slug: 'alpha-sort',
        public: true,
        count: 5,
      }).save();

      const res = deferredResponse();
      tribesController.listTribes(
        {
          query: { sortBy: 'alphabetically' },
          protocol: 'https',
          originalUrl: '/api/tribes',
        },
        res,
      );
      await res.waitForResponse();
      res.body[0].slug.should.equal('zulu');
    });
  });

  describe('getTribe', () => {
    it('returns the tribe attached to the request', async () => {
      const tribe = await new Tribe({ label: 'Shown', slug: 'shown' }).save();
      const res = deferredResponse();
      tribesController.getTribe({ tribe }, res);
      await res.waitForResponse();
      res.body.slug.should.equal('shown');
    });
  });

  describe('tribeBySlug', () => {
    it('attaches a tribe and calls next', async () => {
      const tribe = await new Tribe({
        label: 'Lookup',
        public: true,
      }).save();
      const res = deferredResponse();
      let nextCalled = false;
      const req = {};
      await new Promise(resolve => {
        tribesController.tribeBySlug(
          req,
          res,
          () => {
            nextCalled = true;
            resolve();
          },
          tribe.slug,
        );
      });
      nextCalled.should.be.true();
      req.tribe._id.toString().should.equal(tribe._id.toString());
    });
  });
});
