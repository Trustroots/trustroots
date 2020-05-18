const should = require('should');
const path = require('path');
const stathat = require('stathat');
const sinon = require('sinon');
const _ = require('lodash');
const stathatService = require(path.resolve(
  './modules/stats/server/services/stathat.server.service',
));
const config = require(path.resolve('./config/config'));

describe('Stathat Service Unit Test', function () {
  // replace the stathat.trackEZ<Count|Value><WithTime> with stubs

  beforeEach(function () {
    // stub the service dependencies
    sinon.stub(stathat, 'trackEZCount').callsArgWithAsync(3, 200, null);

    sinon.stub(stathat, 'trackEZCountWithTime').callsArgWithAsync(4, 200, null);

    sinon.stub(stathat, 'trackEZValue').callsArgWithAsync(3, 200, null);

    sinon.stub(stathat, 'trackEZValueWithTime').callsArgWithAsync(4, 200, null);

    // stub the config.stathat.key
    sinon.stub(config.stathat, 'key').value('stathatkey');

    // stub enable stathat in config
    sinon.stub(config.stathat, 'enabled').value(true);
  });

  afterEach(function () {
    // restore the stubbed methods
    sinon.restore();
  });

  context('valid data', function () {
    it('[single count] should call stathat.trackEZCount with proper arguments', function (done) {
      const stat = {
        namespace: 'testCount',
        counts: {
          count: 2,
        },
      };

      stathatService.stat(stat, function (e) {
        if (e) return done(e);

        sinon.assert.calledOnce(stathat.trackEZCount);

        const calledWith = stathat.trackEZCount.getCall(0).args;

        should(calledWith[0]).equal(config.stathat.key);
        should(calledWith[1]).equal(stat.namespace + '.count');
        should(calledWith[2]).equal(stat.counts.count);
        should(calledWith[3]).be.Function();
        should(calledWith[4]).be.undefined();

        return done();
      });
    });

    it('[single count with time] should call stathat.trackEZCountWithTime with proper arguments', function (done) {
      const stat = {
        namespace: 'testCountWithTime',
        counts: {
          count: 2,
        },
        time: new Date('2033-07-13'),
      };

      stathatService.stat(stat, function (e) {
        if (e) return done(e);

        sinon.assert.calledOnce(stathat.trackEZCountWithTime);

        const calledWith = stathat.trackEZCountWithTime.getCall(0).args;

        should(calledWith[0]).equal(config.stathat.key);
        should(calledWith[1]).equal(stat.namespace + '.count');
        should(calledWith[2]).equal(stat.counts.count);
        should(calledWith[3]).equal(stat.time.getTime() / 1000);
        should(calledWith[4]).be.Function();

        return done();
      });
    });

    it('[single value] should call stathat.trackEZValue with proper arguments', function (done) {
      const stat = {
        namespace: 'testValue',
        values: {
          value: 2,
        },
      };

      stathatService.stat(stat, function (e) {
        if (e) return done(e);

        sinon.assert.calledOnce(stathat.trackEZValue);

        const calledWith = stathat.trackEZValue.getCall(0).args;

        should(calledWith[0]).equal(config.stathat.key);
        should(calledWith[1]).equal(stat.namespace + '.value');
        should(calledWith[2]).equal(stat.values.value);
        should(calledWith[3]).be.Function();
        should(calledWith[4]).be.undefined();

        return done();
      });
    });

    it('[single value with time] should call stathat.trackEZValueWithTime with proper arguments', function (done) {
      const stat = {
        namespace: 'testValueWithTime',
        values: {
          value: 3,
        },
        time: new Date('2033-07-15 12:03:05.332'),
      };

      stathatService.stat(stat, function (e) {
        if (e) return done(e);

        sinon.assert.calledOnce(stathat.trackEZValueWithTime);

        const calledWith = stathat.trackEZValueWithTime.getCall(0).args;

        should(calledWith[0]).equal(config.stathat.key);
        should(calledWith[1]).equal(stat.namespace + '.value');
        should(calledWith[2]).equal(stat.values.value);
        should(calledWith[3]).equal(stat.time.getTime() / 1000);
        should(calledWith[4]).be.Function();

        return done();
      });
    });

    it('[a tag specified] should add the tag to the stat_name', function (done) {
      const stat = {
        namespace: 'testValueWithTime',
        values: {
          value: 3,
        },
        tags: {
          first: 'foo',
          second: 'bar',
        },
        time: new Date('2033-07-15 12:03:05.332'),
      };

      stathatService.stat(stat, function (e) {
        if (e) return done(e);

        sinon.assert.callCount(stathat.trackEZValueWithTime, 3);

        // array of arguments of each call to stathat
        const calledWith = _.map(_.range(3), function (n) {
          return stathat.trackEZValueWithTime.getCall(n).args;
        });

        // group the argumets from calls to stathat by their position
        // to test them in groups
        const argmGroups = _.zip.apply(this, calledWith);

        // test the arguments grouped by their position together
        // test the arguments of all the calls to stathat
        _.each(_.range(3), function (n) {
          // 1st argument is stathat key
          should(argmGroups[0][n]).equal(config.stathat.key);

          // 2nd argument is a name
          const defaultName = stat.namespace + '.value';
          should(argmGroups[1]).containEql(
            [
              defaultName, // the default metric name
              defaultName + '.first.foo', // the name with 1st tag
              defaultName + '.second.bar', // the name with 2nd tag
            ][n],
          );

          // 3rd argument is a stat value
          should(argmGroups[2][n]).equal(stat.values.value);

          // 4th argument is a timestamp in seconds
          should(argmGroups[3][n]).equal(stat.time.getTime() / 1000);

          // 5th argument is a callback function
          should(argmGroups[4][n]).be.Function();
        });

        return done();
      });
    });

    it('[multiple counts and values] should call stathat.trackEZCount multiple times with proper arguments', function (done) {
      const stat = {
        namespace: 'testCountWithTime',
        counts: {
          count: 2,
          events: 5,
        },
        values: {
          value: 3,
          other: 7,
        },
      };

      stathatService.stat(stat, function (e) {
        if (e) return done(e);

        sinon.assert.callCount(stathat.trackEZCount, 2);
        sinon.assert.callCount(stathat.trackEZValue, 2);

        const calledWith0 = stathat.trackEZCount.getCall(0).args;
        const calledWith1 = stathat.trackEZCount.getCall(1).args;
        const calledWith2 = stathat.trackEZValue.getCall(0).args;
        const calledWith3 = stathat.trackEZValue.getCall(1).args;

        should(calledWith0[0]).equal(config.stathat.key);
        should([calledWith0[1], calledWith1[1]]).containEql(
          stat.namespace + '.count',
        );
        should([calledWith0[1], calledWith1[1]]).containEql(
          stat.namespace + '.events',
        );
        should(calledWith0[2]).equal(stat.counts.count);
        should(calledWith0[3]).be.Function();

        should([calledWith2[1], calledWith3[1]]).containEql(
          stat.namespace + '.value',
        );
        should([calledWith2[1], calledWith3[1]]).containEql(
          stat.namespace + '.other',
        );

        return done();
      });
    });
  });
});
