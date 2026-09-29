const should = require('should');
const mongoose = require('mongoose');
const config = require('../../../../config/config');
const winston = require('winston');
const statService = require('../../../stats/server/services/stats.server.service');
const sinon = require('sinon');

function queryResult(value, err) {
  return {
    sort: () => ({
      exec: callback => callback(err || null, value),
    }),
    exec: callback => callback(err || null, value),
  };
}

describe('Message server services unit tests', function () {
  afterEach(function () {
    sinon.restore();
  });

  describe('message-to-stats service', function () {
    function loadMessageToStatsService(options = {}) {
      const Message = mongoose.model('Message');
      sinon.stub(Message, 'findOne');
      const serviceConfig = options.config || {
        influxdb: { enabled: true },
        limits: { longMessageMinimumLength: 10 },
      };
      sinon.stub(config, 'influxdb').value(serviceConfig.influxdb);
      sinon.stub(config, 'limits').value(serviceConfig.limits);
      sinon.stub(statService, 'stat');
      const log = sinon.stub(winston.Logger.prototype, 'log');
      const service = require('../../server/services/message-to-stats.server.service');

      return { Message, log, service, statService };
    }

    it('normalizes object-valued message users before building stats', function (done) {
      const { Message, service } = loadMessageToStatsService();
      const created = new Date('2026-01-02T03:04:05Z');
      const message = {
        _id: 'message-id',
        userFrom: { _id: 'from-id' },
        userTo: { _id: 'to-id' },
        content: 'short',
        created,
      };

      Message.findOne.returns(queryResult(message));

      service.process(message, function (err, stat) {
        try {
          should.not.exist(err);
          sinon.assert.calledOnce(Message.findOne);
          Message.findOne.firstCall.args[0].should.eql({
            $or: [
              {
                userTo: 'to-id',
                userFrom: 'from-id',
              },
              {
                userTo: 'from-id',
                userFrom: 'to-id',
              },
            ],
          });
          stat.meta.should.containEql({
            messageId: 'message-id',
            userFrom: 'from-id',
            userTo: 'to-id',
            messageLength: 5,
          });
          stat.tags.should.containEql({
            position: 'first',
            messageLengthType: 'short',
            spam: 'unknown',
          });
          stat.time.should.equal(created);
          done();
        } catch (error) {
          done(error);
        }
      });
    });

    it('keeps primitive message users while building first-message stats', function (done) {
      const { Message, service } = loadMessageToStatsService();
      const message = {
        _id: 'first-message-id',
        userFrom: 'from-id',
        userTo: 'to-id',
        content: 'a message long enough',
        created: new Date('2026-01-02T03:04:05Z'),
        spam: true,
      };

      Message.findOne.returns(queryResult(message));

      service.process(message, function (err, stat) {
        try {
          should.not.exist(err);
          Message.findOne.firstCall.args[0].$or[0].should.eql({
            userTo: 'to-id',
            userFrom: 'from-id',
          });
          stat.tags.should.containEql({
            position: 'first',
            messageLengthType: 'long',
            spam: 'yes',
          });
          stat.values.should.not.have.property('timeToFirstReply');
          done();
        } catch (error) {
          done(error);
        }
      });
    });

    it('adds time-to-first-reply for the first reply in a thread', function (done) {
      const { Message, service } = loadMessageToStatsService();
      const firstMessage = {
        _id: 'first-message-id',
        userFrom: 'from-id',
        userTo: 'to-id',
        content: 'first message',
        created: new Date('2026-01-01T00:00:00Z'),
      };
      const firstReply = {
        _id: 'first-reply-id',
        userFrom: 'to-id',
        userTo: 'from-id',
        content: 'first reply',
        created: new Date('2026-01-01T01:00:00Z'),
        spam: false,
      };

      Message.findOne.onFirstCall().returns(queryResult(firstMessage));
      Message.findOne.onSecondCall().returns(queryResult(firstReply));

      service.process(firstReply, function (err, stat) {
        try {
          should.not.exist(err);
          sinon.assert.calledTwice(Message.findOne);
          Message.findOne.secondCall.args[0].should.eql({
            userTo: 'from-id',
            userFrom: 'to-id',
          });
          stat.tags.should.containEql({
            position: 'firstReply',
            spam: 'no',
          });
          stat.values.timeToFirstReply.should.equal(60 * 60 * 1000);
          done();
        } catch (error) {
          done(error);
        }
      });
    });

    it('marks later reversed-direction messages as other', function (done) {
      const { Message, service } = loadMessageToStatsService();
      const firstMessage = {
        _id: 'first-message-id',
        userFrom: 'from-id',
        userTo: 'to-id',
        content: 'first message',
        created: new Date('2026-01-01T00:00:00Z'),
      };
      const firstReply = {
        _id: 'first-reply-id',
        userFrom: 'to-id',
        userTo: 'from-id',
        content: 'first reply',
        created: new Date('2026-01-01T01:00:00Z'),
      };
      const laterReply = {
        _id: 'later-reply-id',
        userFrom: 'to-id',
        userTo: 'from-id',
        content: 'later reply',
        created: new Date('2026-01-01T02:00:00Z'),
      };

      Message.findOne.onFirstCall().returns(queryResult(firstMessage));
      Message.findOne.onSecondCall().returns(queryResult(firstReply));

      service.process(laterReply, function (err, stat) {
        try {
          should.not.exist(err);
          stat.tags.position.should.equal('other');
          stat.values.should.not.have.property('timeToFirstReply');
          done();
        } catch (error) {
          done(error);
        }
      });
    });

    it('logs unexpected save failures outside test mode without requiring a callback', function () {
      const { log, service } = loadMessageToStatsService();
      const originalNodeEnv = process.env.NODE_ENV;
      const error = new Error('stats write failed');

      process.env.NODE_ENV = 'development';
      sinon
        .stub(service, 'process')
        .callsArgWith(1, null, { namespace: 'messages' });
      sinon.stub(service, 'send').callsArgWith(1, error);

      try {
        service.save({ _id: 'message-id' });
        sinon.assert.calledOnce(log);
        log.firstCall.args.slice(0, 2).should.deepEqual([
          'error',
          'Saving message stats failed.',
        ]);
        log.firstCall.args[2].should.deepEqual({ name: 'Error' });
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });

    it('treats missing influx config as disabled', function (done) {
      const { service } = loadMessageToStatsService({ config: {} });

      service.save({ _id: 'message-id' }, function (err) {
        try {
          err.should.be.an.Error();
          err.message.should.match(/InfluxDB disabled/);
          done();
        } catch (error) {
          done(error);
        }
      });
    });

    it('delegates processed stats to the stats service', function (done) {
      const { service, statService } = loadMessageToStatsService();
      const statObject = { namespace: 'messages', counts: { sent: 1 } };
      statService.stat.callsArgWith(1, null);

      service.send(statObject, function (err) {
        try {
          should.not.exist(err);
          sinon.assert.calledOnceWithExactly(
            statService.stat,
            statObject,
            sinon.match.func,
          );
          done();
        } catch (error) {
          done(error);
        }
      });
    });
  });

  describe('message-stat service', function () {
    function loadMessageStatService(options = {}) {
      const Message = mongoose.model('Message');
      const MessageStat = mongoose.model('MessageStat');
      sinon.stub(Message, 'findOne');
      sinon.stub(MessageStat.prototype, 'save');
      sinon.stub(MessageStat, 'findOne');
      sinon.stub(MessageStat, 'findOneAndUpdate');
      sinon.stub(MessageStat, 'find');
      const service = require('../../server/services/message-stat.server.service');

      if (options.messageStatFindOne) {
        MessageStat.findOne.returns(options.messageStatFindOne);
      }
      if (options.messageFindOne) {
        Message.findOne.returns(options.messageFindOne);
      }

      return { Message, MessageStat, service };
    }

    it('returns create errors when the first message stat cannot be saved', function (done) {
      const firstMessage = {
        userFrom: 'from-id',
        userTo: 'to-id',
        created: new Date('2026-01-01T00:00:00Z'),
        content: 'hello',
      };
      const { MessageStat, service } = loadMessageStatService({
        messageStatFindOne: queryResult(null),
        messageFindOne: queryResult(firstMessage),
      });
      const error = new Error('save failed');
      MessageStat.prototype.save.callsArgWith(0, error);

      service.updateMessageStat(firstMessage, function (err) {
        try {
          err.should.equal(error);
          done();
        } catch (assertionError) {
          done(assertionError);
        }
      });
    });

    it('returns first-reply update errors', function (done) {
      const firstMessageCreated = new Date('2026-01-01T00:00:00Z');
      const messageStat = {
        firstMessageUserFrom: 'from-id',
        firstMessageUserTo: 'to-id',
        firstMessageCreated,
        timeToFirstReply: null,
      };
      const firstReply = {
        userFrom: 'to-id',
        userTo: 'from-id',
        created: new Date('2026-01-02T00:00:00Z'),
        content: 'reply',
      };
      const { MessageStat, service } = loadMessageStatService({
        messageStatFindOne: queryResult(messageStat),
        messageFindOne: queryResult(firstReply),
      });
      const error = new Error('update failed');
      MessageStat.findOneAndUpdate.returns({
        exec: callback => callback(error),
      });

      service.updateMessageStat(firstReply, function (err) {
        try {
          err.should.equal(error);
          sinon.assert.calledOnce(MessageStat.findOneAndUpdate);
          MessageStat.findOneAndUpdate.firstCall.args[1].$set.should.containEql(
            {
              firstReplyCreated: firstReply.created,
              firstReplyLength: firstReply.content.length,
              timeToFirstReply:
                firstReply.created.getTime() - firstMessageCreated.getTime(),
            },
          );
          done();
        } catch (assertionError) {
          done(assertionError);
        }
      });
    });

    it('returns read errors before formatting message stats', function (done) {
      const error = new Error('find failed');
      const { MessageStat, service } = loadMessageStatService();
      MessageStat.find.returns({
        sort: () => ({
          populate: () => ({
            exec: callback => callback(error),
          }),
        }),
      });

      service.readMessageStatsOfUser(
        'user-id',
        new Date('2026-02-01T00:00:00Z').getTime(),
        function (err) {
          try {
            err.should.equal(error);
            done();
          } catch (assertionError) {
            done(assertionError);
          }
        },
      );
    });
  });
});
