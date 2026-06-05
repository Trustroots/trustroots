/**
 * Unit tests for stats service helper functions.
 */
const statsService = require('../../server/services/stats.server.service');
require('should');

describe('Stats service unit tests', () => {
  it('records a count stat', done => {
    statsService.count('unitCount', done);
  });

  it('records a value stat', done => {
    statsService.value('unitValue', 12, done);
  });

  it('rejects an invalid stat object', done => {
    statsService.stat({ values: { count: 1 } }, err => {
      err.should.be.Error();
      done();
    });
  });
});
