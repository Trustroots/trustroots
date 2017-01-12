'use strict';

var should = require('should'),
    path = require('path'),
    stathatService = require(path.resolve('./modules/stats/server/services/stathat.server.service')),
    config = require(path.resolve('./config/config')),
    stathat = require('stathat'),
    sinon = require('sinon');

describe('Stathat Service Unit Test', function () {
  // replace the stathat.trackEZ<Count|Value><WithTime> with stubs
  var sandbox;

  beforeEach(function () {
    // sandboxing in sinon helps restore the spied/stubbed/mocked functions
    sandbox = sinon.sandbox.create();

    // stub the service dependencies
    sandbox.stub(stathat, 'trackEZCount');
    stathat.trackEZCount.callsArgAsync(3);

    sandbox.stub(stathat, 'trackEZCountWithTime');
    stathat.trackEZCountWithTime.callsArgAsync(4);

    sandbox.stub(stathat, 'trackEZValue');
    stathat.trackEZValue.callsArgAsync(3);

    sandbox.stub(stathat, 'trackEZValueWithTime');
    stathat.trackEZValueWithTime.callsArgAsync(4);

    // stub the config.stathat.key
    sandbox.stub(config.stathat, 'key', 'stathatkey');

    // stub enable stathat in config
    sandbox.stub(config.stathat, 'enabled', true);

  });

  afterEach(function () {
    // restore the stubbed methods
    sandbox.restore();
  });


  context('valid data', function () {

    it('[single count] should call stathat.trackEZCount with proper arguments', function (done) {
      var stat = {
        namespace: 'testCount',
        counts: {
          count: 2
        }
      };

      stathatService.stat(stat, function (e) {
        if (e) return done(e);

        sinon.assert.calledOnce(stathat.trackEZCount);

        var calledWith = stathat.trackEZCount.getCall(0).args;

        should(calledWith[0]).equal(config.stathat.key);
        should(calledWith[1]).equal(stat.namespace + '.count');
        should(calledWith[2]).equal(stat.counts.count);
        should(calledWith[3]).be.Function();
        should(calledWith[4]).be.undefined();

        return done();
      });
    });

    it('[single count with time] should call stathat.trackEZCountWithTime with proper arguments', function (done) {
      var stat = {
        namespace: 'testCountWithTime',
        counts: {
          count: 2
        },
        time: new Date('2033-07-13')
      };

      stathatService.stat(stat, function (e) {
        if (e) return done(e);

        sinon.assert.calledOnce(stathat.trackEZCountWithTime);

        var calledWith = stathat.trackEZCountWithTime.getCall(0).args;

        should(calledWith[0]).equal(config.stathat.key);
        should(calledWith[1]).equal(stat.namespace + '.count');
        should(calledWith[2]).equal(stat.counts.count);
        should(calledWith[3]).equal(stat.time.getTime() / 1000);
        should(calledWith[4]).be.Function();

        return done();
      });
    });

    it('[single value] should call stathat.trackEZValue with proper arguments', function (done) {
      var stat = {
        namespace: 'testValue',
        values: {
          value: 2
        }
      };

      stathatService.stat(stat, function (e) {
        if (e) return done(e);

        sinon.assert.calledOnce(stathat.trackEZValue);

        var calledWith = stathat.trackEZValue.getCall(0).args;

        should(calledWith[0]).equal(config.stathat.key);
        should(calledWith[1]).equal(stat.namespace + '.value');
        should(calledWith[2]).equal(stat.values.value);
        should(calledWith[3]).be.Function();
        should(calledWith[4]).be.undefined();

        return done();
      });
    });

    it('[single value with time] should call stathat.trackEZValueWithTime with proper arguments', function (done) {
      var stat = {
        namespace: 'testValueWithTime',
        values: {
          value: 3
        },
        time: new Date('2033-07-15 12:03:05.332')
      };

      stathatService.stat(stat, function (e) {
        if (e) return done(e);

        sinon.assert.calledOnce(stathat.trackEZValueWithTime);

        var calledWith = stathat.trackEZValueWithTime.getCall(0).args;

        should(calledWith[0]).equal(config.stathat.key);
        should(calledWith[1]).equal(stat.namespace + '.value');
        should(calledWith[2]).equal(stat.values.value);
        should(calledWith[3]).equal(stat.time.getTime() / 1000);
        should(calledWith[4]).be.Function();

        return done();
      });
    });

    it('[a tag specified] should add the tag to the stat_name', function (done) {
      var stat = {
        namespace: 'testValueWithTime',
        values: {
          value: 3
        },
        tags: {
          first: 'foo',
          second: 'bar'
        },
        time: new Date('2033-07-15 12:03:05.332')
      };

      stathatService.stat(stat, function (e) {
        if (e) return done(e);

        sinon.assert.callCount(stathat.trackEZValueWithTime, 3);

        var calledWith0 = stathat.trackEZValueWithTime.getCall(0).args;
        // @TODO to use later
        // var calledWith1 = stathat.trackEZValueWithTime.getCall(1).args;
        // var calledWith2 = stathat.trackEZValueWithTime.getCall(2).args;

        should(calledWith0[0]).equal(config.stathat.key);
        should(calledWith0[1]).equal(stat.namespace + '.value');
        should(calledWith0[2]).equal(stat.values.value);
        should(calledWith0[3]).equal(stat.time.getTime() / 1000);
        should(calledWith0[4]).be.Function();

        return done();
      });
    });

    it('[multiple counts and values] should call stathat.trackEZCount multiple times with proper arguments', function (done) {
      var stat = {
        namespace: 'testCountWithTime',
        counts: {
          count: 2,
          events: 5
        },
        values: {
          value: 3,
          other: 7
        }
      };

      stathatService.stat(stat, function (e) {
        if (e) return done(e);

        sinon.assert.callCount(stathat.trackEZCount, 2);
        sinon.assert.callCount(stathat.trackEZValue, 2);

        var calledWith0 = stathat.trackEZCount.getCall(0).args;
        var calledWith1 = stathat.trackEZCount.getCall(1).args;
        var calledWith2 = stathat.trackEZValue.getCall(0).args;
        var calledWith3 = stathat.trackEZValue.getCall(1).args;

        should(calledWith0[0]).equal(config.stathat.key);
        should([calledWith0[1], calledWith1[1]]).containEql(stat.namespace + '.count');
        should([calledWith0[1], calledWith1[1]]).containEql(stat.namespace + '.events');
        should(calledWith0[2]).equal(stat.counts.count);
        should(calledWith0[3]).be.Function();

        should([calledWith2[1], calledWith3[1]]).containEql(stat.namespace + '.value');
        should([calledWith2[1], calledWith3[1]]).containEql(stat.namespace + '.other');

        return done();
      });
    });
  });
});
