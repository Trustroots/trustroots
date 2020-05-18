const should = require('should');
const path = require('path');
const statsService = require(path.resolve(
  './modules/stats/server/services/stats.server.service',
));
const stathatService = require(path.resolve(
  './modules/stats/server/services/stathat.server.service',
));
const influxService = require(path.resolve(
  './modules/stats/server/services/influx.server.service',
));
const sinon = require('sinon');

describe('General Stats API Service Unit Tests', function () {
  // replace the influx & stathat service stat() functions with fake version

  beforeEach(function () {
    // stub the service dependencies
    sinon.stub(stathatService, 'stat');
    stathatService.stat.callsArgAsync(1);

    sinon.stub(influxService, 'stat');
    influxService.stat.callsArgAsync(1);
  });

  afterEach(function () {
    // restore the stubbed services
    sinon.restore();
  });

  describe('The stat(stat) function', function () {
    context('invalid data', function () {
      it('[namespace not string] should throw error: The stat.namespace should be a string', function (done) {
        statsService.stat({ namespace: null }, function (e) {
          try {
            should(e.message).equal('The stat.namespace should be a string');
            return done();
          } catch (e) {
            return done(e);
          }
        });
      });

      it('[missing counts and values] should throw error: The stat should contain counts or values', function (done) {
        statsService.stat({ namespace: 'test' }, function (e) {
          try {
            should(e.message).equal('The stat should contain counts or values');
            return done();
          } catch (e) {
            return done(e);
          }
        });
      });

      it('[counts and values empty] should throw error: The stats should contain counts or values', function (done) {
        statsService.stat(
          { namespace: 'test', counts: {}, values: {} },
          function (e) {
            try {
              should(e.message).equal(
                'The stat should contain counts or values',
              );
              return done();
            } catch (e) {
              return done(e);
            }
          },
        );
      });

      it('[keys are duplicate in stat.<counts|values|meta|tags>] should throw error: Every key of stat counts, values, meta and tags must be unique', function (done) {
        const statWithDuplicates = {
          namespace: 'test',
          counts: { duplicate: 1 },
          values: { duplicate: 'value' },
          meta: { duplicate: 'meta' },
          tags: { duplicate: 'tag' },
        };

        statsService.stat(statWithDuplicates, function (e) {
          try {
            should(e.message).equal(
              'Every key of stat counts, values, meta and tags must be unique',
            );
            return done();
          } catch (e) {
            return done(e);
          }
        });
      });
    });

    context('valid data', function () {
      const validData = {
        namespace: 'test',
        counts: {
          testCount: 1,
        },
        values: {
          testValue: 3.5,
        },
        meta: {
          testMeta: 13,
        },
        tags: {
          testTag: 'testing',
        },
      };

      it('should reach influxService.stat with correct data', function (done) {
        statsService.stat(validData, function (e) {
          if (e) return done(e);

          sinon.assert.calledOnce(influxService.stat);

          const calledWith = influxService.stat.getCall(0).args[0];

          should(calledWith).have.property('namespace', 'test');
          should(calledWith).have.propertyByPath('counts', 'testCount').eql(1);
          should(calledWith)
            .have.propertyByPath('values', 'testValue')
            .eql(3.5);
          should(calledWith).have.propertyByPath('meta', 'testMeta').eql(13);
          should(calledWith)
            .have.propertyByPath('tags', 'testTag')
            .eql('testing');

          return done();
        });
      });

      it('should reach stathatService.stat with correct data', function (done) {
        statsService.stat(validData, function (e) {
          if (e) return done(e);

          sinon.assert.calledOnce(stathatService.stat);

          const calledWith = stathatService.stat.getCall(0).args[0];

          should(calledWith).have.property('namespace', 'test');
          should(calledWith).have.propertyByPath('counts', 'testCount').eql(1);
          should(calledWith)
            .have.propertyByPath('values', 'testValue')
            .eql(3.5);
          should(calledWith).have.propertyByPath('meta', 'testMeta').eql(13);
          should(calledWith)
            .have.propertyByPath('tags', 'testTag')
            .eql('testing');

          return done();
        });
      });
    });
  });

  describe('The count(name, ?count, ?time) function', function () {
    it('[count(name)] should reach the influx & stathat services with correct data', function (done) {
      statsService.count('testCount', function (e) {
        if (e) return done(e);

        sinon.assert.calledOnce(influxService.stat);
        sinon.assert.calledOnce(stathatService.stat);

        const influxCalledWith = influxService.stat.getCall(0).args[0];
        const stathatCalledWith = stathatService.stat.getCall(0).args[0];

        should(influxCalledWith).have.property('namespace', 'testCount');
        should(stathatCalledWith).have.property('namespace', 'testCount');

        should(influxCalledWith).have.propertyByPath('counts', 'count').eql(1);
        should(stathatCalledWith).have.propertyByPath('counts', 'count').eql(1);

        should(influxCalledWith).not.have.property('time');
        should(stathatCalledWith).not.have.property('time');

        should(influxCalledWith).not.have.property('values');
        should(stathatCalledWith).not.have.property('values');

        return done();
      });
    });

    it('[count(name, count)] should reach the influx & stathat services with correct data', function (done) {
      statsService.count('testCount', 3, function (e) {
        if (e) return done(e);

        sinon.assert.calledOnce(influxService.stat);
        sinon.assert.calledOnce(stathatService.stat);

        const influxCalledWith = influxService.stat.getCall(0).args[0];
        const stathatCalledWith = stathatService.stat.getCall(0).args[0];

        should(influxCalledWith).have.property('namespace', 'testCount');
        should(stathatCalledWith).have.property('namespace', 'testCount');

        should(influxCalledWith).have.propertyByPath('counts', 'count').eql(3);
        should(stathatCalledWith).have.propertyByPath('counts', 'count').eql(3);

        should(influxCalledWith).not.have.property('time');
        should(stathatCalledWith).not.have.property('time');

        should(influxCalledWith).not.have.property('values');
        should(stathatCalledWith).not.have.property('values');

        return done();
      });
    });

    it('[count(name, count, time)] should reach the influx & stathat services with correct data', function (done) {
      // a random testing time
      const time = new Date('2000-01-01');

      statsService.count('testCount', 3, time, function (e) {
        if (e) return done(e);

        sinon.assert.calledOnce(influxService.stat);
        sinon.assert.calledOnce(stathatService.stat);

        const influxCalledWith = influxService.stat.getCall(0).args[0];
        const stathatCalledWith = stathatService.stat.getCall(0).args[0];

        should(influxCalledWith).have.property('namespace', 'testCount');
        should(stathatCalledWith).have.property('namespace', 'testCount');

        should(influxCalledWith).have.propertyByPath('counts', 'count').eql(3);
        should(stathatCalledWith).have.propertyByPath('counts', 'count').eql(3);

        should(influxCalledWith).have.property('time', time);
        should(stathatCalledWith).have.property('time', time);

        should(influxCalledWith).not.have.property('values');
        should(stathatCalledWith).not.have.property('values');

        return done();
      });
    });
  });

  describe('The value(name, value, ?time)', function () {
    it('[value(name, value)] should reach the influx & stathat services with correct data', function (done) {
      const name = 'testValue';
      const value = -13.31;

      statsService.value(name, value, function (e) {
        if (e) return done(e);

        sinon.assert.calledOnce(influxService.stat);
        sinon.assert.calledOnce(stathatService.stat);

        const influxCalledWith = influxService.stat.getCall(0).args[0];
        const stathatCalledWith = stathatService.stat.getCall(0).args[0];

        should(influxCalledWith).have.property('namespace', name);
        should(stathatCalledWith).have.property('namespace', name);

        should(influxCalledWith)
          .have.propertyByPath('values', 'value')
          .eql(value);
        should(stathatCalledWith)
          .have.propertyByPath('values', 'value')
          .eql(value);

        should(influxCalledWith).not.have.property('time');
        should(stathatCalledWith).not.have.property('time');

        should(influxCalledWith).not.have.property('counts');
        should(stathatCalledWith).not.have.property('counm ,ts');

        return done();
      });
    });

    it('[value(name, value, time)] should reach the influx & stathat services with correct data', function (done) {
      const name = 'testValue';
      const value = -13.31;
      const time = new Date('2000-01-01');

      statsService.value(name, value, time, function (e) {
        if (e) return done(e);

        sinon.assert.calledOnce(influxService.stat);
        sinon.assert.calledOnce(stathatService.stat);

        const influxCalledWith = influxService.stat.getCall(0).args[0];
        const stathatCalledWith = stathatService.stat.getCall(0).args[0];

        should(influxCalledWith).have.property('namespace', name);
        should(stathatCalledWith).have.property('namespace', name);

        should(influxCalledWith)
          .have.propertyByPath('values', 'value')
          .eql(value);
        should(stathatCalledWith)
          .have.propertyByPath('values', 'value')
          .eql(value);

        should(influxCalledWith).have.property('time', time);
        should(stathatCalledWith).have.property('time', time);

        should(influxCalledWith).not.have.property('counts');
        should(stathatCalledWith).not.have.property('counts');

        return done();
      });
    });
  });
});
