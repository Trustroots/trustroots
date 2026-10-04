const paginationService = require('../../../server/services/pagination.server.service');

const should = require('should');

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
  it('exposes callable named ESM exports', async function () {
    const esmService = await import(
      '../../../server/services/pagination.server.service.mjs'
    );
    for (const name of ['setLinkHeader']) {
      esmService[name].should.equal(paginationService[name]);
    }
  });

  describe('setLinkHeader', function () {
    it('sets a next link header pointing at the following page', function () {
      const req = { query: { page: '2', limit: '20' } };
      const res = mockResponse();
      paginationService.setLinkHeader(req, res, 3);
      res.linksSet.should.have.property('next');
      res.linksSet.next.should.endWith('?page=3');
      res.linksSet.next.should.match(/^https?:\/\/[^/?#]+\?page=3$/);
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
  });
});
