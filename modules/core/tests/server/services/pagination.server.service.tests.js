const paginationService = require('../../../server/services/pagination.server.service.mjs');
const config = require('../../../../../config/config.mjs');

const should = require('should');
const express = require('express');
const request = require('supertest');

/**
 * Minimal Express-like response mock supporting the subset of methods used
 * by `setLinkHeader`: links() and `locals.paginate.href`.
 */
function mockResponse() {
  const res = {
    linksSet: null,
    locals: {
      paginate: {
        href: query => `?page=${query.page}`,
      },
    },
  };
  res.links = function (links) {
    res.linksSet = links;
    return res;
  };
  return res;
}

describe('Service: pagination', function () {
  it('preserves defaults, bounds, offsets and structured filters in next links', async () => {
    const app = express();
    app.set('query parser', query => require('qs').parse(query));
    app.use((req, res, next) => {
      Object.defineProperty(req, 'query', { value: req.query });
      next();
    });
    app.use(paginationService.middleware(20, 50));
    app.get('/items', (req, res) => {
      paginationService.setLinkHeader(req, res, 5, { relative: true });
      res.json({ query: req.query, skip: req.skip, offset: req.offset });
    });
    for (const [query, page, limit, skip] of [
      ['', 1, 20, 0],
      ['?page=2&limit=100', 2, 50, 50],
      ['?page=-2&limit=-3', 1, 0, 0],
      ['?page=invalid&limit=invalid', 1, 0, 0],
      ['?page=0&limit=0', 1, 0, 0],
      ['?page[]=2&limit[]=10', 1, 20, 0],
      ['?page=5&limit=10', 5, 10, 40],
    ]) {
      const res = await request(app)
        .get('/items' + query)
        .expect(200);
      res.body.should.deepEqual({ query: { page, limit }, skip, offset: skip });
      if (page === 5) should(res.headers.link).be.undefined();
      else res.headers.link.should.containEql(`page=${page + 1}`);
    }
    const res = await request(app)
      .get('/items?page=2&limit=10&filter[tag][]=one&filter[tag][]=two')
      .expect(200);
    res.headers.link.should.equal(
      '</items?page=3&limit=10&filter%5Btag%5D%5B0%5D=one&filter%5Btag%5D%5B1%5D=two>; rel="next"',
    );
  });

  it('exports the link helper', function () {
    paginationService.setLinkHeader.should.be.a.Function();
  });

  describe('setLinkHeader', function () {
    it('sets a next link header pointing at the following page', function () {
      const originalHttps = config.https;
      try {
        config.https = true;
        const req = { query: { page: '2', limit: '20' } };
        const res = mockResponse();
        paginationService.setLinkHeader(req, res, 3);
        res.linksSet.should.have.property('next');
        res.linksSet.next.should.endWith('?page=3');
        res.linksSet.next.should.match(/^https:\/\/[^/?#]+\?page=3$/);
      } finally {
        config.https = originalHttps;
      }
    });

    it('does not set a link header on the last page', function () {
      const req = { query: { page: 3, limit: 20 } };
      const res = mockResponse();
      paginationService.setLinkHeader(req, res, 3);
      should(res.linksSet).be.null();
    });

    it('can keep catalogue links relative', function () {
      const req = { query: { page: '2', limit: '20' } };
      const res = mockResponse();
      paginationService.setLinkHeader(req, res, 3, { relative: true });
      res.linksSet.next.should.equal('?page=3');
    });

    it('uses HTTP when HTTPS is disabled', function () {
      const originalHttps = config.https;
      try {
        config.https = false;
        const req = { query: { page: '1', limit: '20' } };
        const res = mockResponse();
        paginationService.setLinkHeader(req, res, 2);
        res.linksSet.next.should.startWith('http://');
      } finally {
        config.https = originalHttps;
      }
    });
  });
});
