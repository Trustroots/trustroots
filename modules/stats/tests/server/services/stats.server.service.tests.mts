import type { StatObject } from '../../../server/services/stats.server.service.mts';

import should from 'should';
import statsService from './../../../server/services/stats.server.service.mts';
import influxService from './../../../server/services/influx.server.service.mts';
import sinon, { type SinonStub } from 'sinon';

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
