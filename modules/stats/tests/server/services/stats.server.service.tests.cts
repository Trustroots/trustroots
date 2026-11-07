import type { SinonStub } from 'sinon';
import type { StatObject } from '../../../server/services/stats.server.service.mts';

const should: typeof import('should') = require('should');
const statsService: typeof import('../../../server/services/stats.server.service.mts').default = require('./../../../server/services/stats.server.service.mts');
const influxService: typeof import('../../../server/services/influx.server.service.mts').default = require('./../../../server/services/influx.server.service.mts');
const sinon: typeof import('sinon') = require('sinon');

describe('General Stats API Service Unit Tests', function () {
  let influxStat: SinonStub;

  beforeEach(function () {
    // replace the influx service stat() function with fake version
    influxStat = sinon.stub(influxService, 'stat');
    influxStat.callsArgAsync(1);
  });

  afterEach(function () {
    // restore the stubbed services
    sinon.restore();
  });

  describe('The stat(stat) function', function () {
    context('invalid data', function () {
      it('[namespace not string] should throw error: The stat.namespace should be a string', function (done) {
        statsService.stat(
          { namespace: null } as unknown as StatObject,
          function (e: Error | null | undefined) {
            try {
              should(e?.message).equal('The stat.namespace should be a string');
              return done();
            } catch (e) {
              return done(e);
            }
          },
        );
      });
    });
  });
});
