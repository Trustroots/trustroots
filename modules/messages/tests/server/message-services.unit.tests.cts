import type {
  MessageModel,
  MessageRecord,
  MessageStatModel,
  MessageStatRecord,
  MessageStatsPoint,
  TestConfigModule,
} from '../../../../testutils/server/model-contracts.mts';
const should: typeof import('should') = require('should');
const mongoose: typeof import('mongoose') = require('mongoose');
const config: TestConfigModule = require('./../../../../config/config.mts');
const winston: typeof import('winston') = require('winston');
const statService: typeof import('./../../../stats/server/services/stats.server.service.mts') = require('./../../../stats/server/services/stats.server.service.mts');
const sinon: typeof import('sinon') = require('sinon');

type TestQueryResult<T> = {
  sort(): TestQueryResult<T>;
  populate(): TestQueryResult<T>;
  exec(): Promise<T>;
  exec(callback: (error: Error | null, value?: T) => void): void;
};

function queryResult<T>(
  value: T,
  err: Error | null = null,
): TestQueryResult<T> {
  function exec(): Promise<T>;
  function exec(callback: (error: Error | null, value?: T) => void): void;
  function exec(
    callback?: (error: Error | null, value?: T) => void,
  ): void | Promise<T> {
    if (callback) {
      callback(err, value);
      return;
    }
    return err ? Promise.reject(err) : Promise.resolve(value);
  }
  const result: TestQueryResult<T> = {
    sort() {
      return this;
    },
    populate() {
      return this;
    },
    exec,
  };
  return result;
}
function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('Expected value');
  return value;
}

type MessageStatServiceOptions = {
  config?: {
    influxdb?: { enabled?: boolean };
    limits?: { longMessageMinimumLength?: number };
  };
};
type StatServiceOptions = {
  messageStatFindOne?: TestQueryResult<unknown>;
  messageFindOne?: TestQueryResult<unknown>;
};

describe('Message server services unit tests', function () {
  afterEach(function () {
    sinon.restore();
  });

  describe('message-to-stats service', function () {
    function loadMessageToStatsService(
      options: MessageStatServiceOptions = {},
    ) {
      const Message = mongoose.model<MessageRecord, MessageModel>('Message');
      const findOne = sinon.stub(Message, 'findOne');
      const serviceConfig = options.config || {
        influxdb: { enabled: true },
        limits: { longMessageMinimumLength: 10 },
      };
      sinon.stub(config, 'influxdb').value(serviceConfig.influxdb);
      sinon.stub(config, 'limits').value(serviceConfig.limits);
      const stat = sinon.stub(statService, 'stat');
      const log = sinon.stub(winston.Logger.prototype, 'log');
      const service = require('./../../server/services/message-to-stats.server.service.mjs');

      return { Message, findOne, log, service, stat };
    }

    it('normalizes object-valued message users before building stats', function (done) {
      const { findOne, service } = loadMessageToStatsService();
      const created = new Date('2026-01-02T03:04:05Z');
      const message = {
        _id: 'message-id',
        userFrom: { _id: 'from-id' },
        userTo: { _id: 'to-id' },
        content: 'short',
        created,
      };

      findOne.returns(
        queryResult(message) as unknown as ReturnType<MessageModel['findOne']>,
      );

      service.process(
        message,
        function (err: Error | null, stat: MessageStatsPoint) {
          try {
            should.not.exist(err);
            sinon.assert.calledOnce(findOne);
            required(findOne.firstCall.args[0]).should.eql({
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
        },
      );
    });

    it('keeps primitive message users while building first-message stats', function (done) {
      const { findOne, service } = loadMessageToStatsService();
      const message = {
        _id: 'first-message-id',
        userFrom: 'from-id',
        userTo: 'to-id',
        content: 'a message long enough',
        created: new Date('2026-01-02T03:04:05Z'),
        spam: true,
      };

      findOne.returns(
        queryResult(message) as unknown as ReturnType<MessageModel['findOne']>,
      );

      service.process(
        message,
        function (err: Error | null, stat: MessageStatsPoint) {
          try {
            should.not.exist(err);
            const query = required(findOne.firstCall.args[0]);
            if (!('$or' in query) || !Array.isArray(query.$or))
              throw new Error('Expected a message pair filter');
            required(query.$or?.[0]).should.eql({
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
        },
      );
    });

    it('adds time-to-first-reply for the first reply in a thread', function (done) {
      const { findOne, service } = loadMessageToStatsService();
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

      findOne
        .onFirstCall()
        .returns(
          queryResult(firstMessage) as unknown as ReturnType<
            MessageModel['findOne']
          >,
        );
      findOne
        .onSecondCall()
        .returns(
          queryResult(firstReply) as unknown as ReturnType<
            MessageModel['findOne']
          >,
        );

      service.process(
        firstReply,
        function (err: Error | null, stat: MessageStatsPoint) {
          try {
            should.not.exist(err);
            sinon.assert.calledTwice(findOne);
            required(findOne.secondCall.args[0]).should.eql({
              userTo: 'from-id',
              userFrom: 'to-id',
            });
            stat.tags.should.containEql({
              position: 'firstReply',
              spam: 'no',
            });
            required(stat.values.timeToFirstReply).should.equal(60 * 60 * 1000);
            done();
          } catch (error) {
            done(error);
          }
        },
      );
    });

    it('marks later reversed-direction messages as other', function (done) {
      const { findOne, service } = loadMessageToStatsService();
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

      findOne
        .onFirstCall()
        .returns(
          queryResult(firstMessage) as unknown as ReturnType<
            MessageModel['findOne']
          >,
        );
      findOne
        .onSecondCall()
        .returns(
          queryResult(firstReply) as unknown as ReturnType<
            MessageModel['findOne']
          >,
        );

      service.process(
        laterReply,
        function (err: Error | null, stat: MessageStatsPoint) {
          try {
            should.not.exist(err);
            stat.tags.position.should.equal('other');
            stat.values.should.not.have.property('timeToFirstReply');
            done();
          } catch (error) {
            done(error);
          }
        },
      );
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
        log.firstCall.args
          .slice(0, 2)
          .should.deepEqual(['error', 'Saving message stats failed.']);
        should.deepEqual(
          (
            log.firstCall.args as unknown as [string, string, { name: string }]
          )[2],
          { name: 'Error' },
        );
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });

    it('treats missing influx config as disabled', function (done) {
      const { service } = loadMessageToStatsService({ config: {} });

      service.save({ _id: 'message-id' }, function (err?: Error | null) {
        try {
          if (!err) throw new Error('Expected disabled InfluxDB error');
          err.should.be.an.Error();
          err.message.should.match(/InfluxDB disabled/);
          done();
        } catch (error) {
          done(error);
        }
      });
    });

    it('returns processing errors from save without sending stats', function (done) {
      const { service, stat } = loadMessageToStatsService();
      const error = new Error('message stats processing failed');
      sinon.stub(service, 'process').callsArgWith(1, error);

      service.save({ _id: 'message-id' }, function (err?: Error | null) {
        try {
          should(err).equal(error);
          sinon.assert.notCalled(stat);
          done();
        } catch (assertionError) {
          done(assertionError);
        }
      });
    });

    it('delegates processed stats to the stats service', function (done) {
      const { service, stat } = loadMessageToStatsService();
      const statObject = { namespace: 'messages', counts: { sent: 1 } };
      stat.callsArgWith(1, null);

      service.send(statObject, function (err?: Error | null) {
        try {
          should.not.exist(err);
          sinon.assert.calledOnceWithExactly(
            stat,
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
    function loadMessageStatService(options: StatServiceOptions = {}) {
      const Message = mongoose.model<MessageRecord, MessageModel>('Message');
      const MessageStat = mongoose.model<MessageStatRecord, MessageStatModel>(
        'MessageStat',
      );
      const messageFindOne = sinon.stub(Message, 'findOne');
      const save = sinon.stub(MessageStat.prototype, 'save');
      const statFindOne = sinon.stub(MessageStat, 'findOne');
      const statFindOneAndUpdate = sinon.stub(MessageStat, 'findOneAndUpdate');
      const statFind = sinon.stub(MessageStat, 'find');
      const service = require('./../../server/services/message-stat.server.service.mjs');

      if (options.messageStatFindOne) {
        statFindOne.returns(
          options.messageStatFindOne as unknown as ReturnType<
            typeof statFindOne
          >,
        );
      }
      if (options.messageFindOne) {
        messageFindOne.returns(
          options.messageFindOne as unknown as ReturnType<
            typeof messageFindOne
          >,
        );
      }

      return {
        Message,
        MessageStat,
        service,
        messageFindOne,
        save,
        statFindOne,
        statFindOneAndUpdate,
        statFind,
      };
    }

    it('returns create errors when the first message stat cannot be saved', function (done) {
      const firstMessage = {
        userFrom: 'from-id',
        userTo: 'to-id',
        created: new Date('2026-01-01T00:00:00Z'),
        content: 'hello',
      };
      const { service, save } = loadMessageStatService({
        messageStatFindOne: queryResult(null),
        messageFindOne: queryResult(firstMessage),
      });
      const error = new Error('save failed');
      save.rejects(error);

      service.updateMessageStat(firstMessage, function (err?: Error | null) {
        try {
          if (!err) throw new Error('Expected save error');
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
      const { service, statFindOneAndUpdate } = loadMessageStatService({
        messageStatFindOne: queryResult(messageStat),
        messageFindOne: queryResult(firstReply),
      });
      const error = new Error('update failed');
      statFindOneAndUpdate.returns({
        exec: () => Promise.reject(error),
      } as unknown as ReturnType<typeof statFindOneAndUpdate>);

      service.updateMessageStat(firstReply, function (err?: Error | null) {
        try {
          if (!err) throw new Error('Expected update error');
          err.should.equal(error);
          sinon.assert.calledOnce(statFindOneAndUpdate);
          required(
            required(statFindOneAndUpdate.firstCall.args[1]).$set,
          ).should.containEql({
            firstReplyCreated: firstReply.created,
            firstReplyLength: firstReply.content.length,
            timeToFirstReply:
              firstReply.created.getTime() - firstMessageCreated.getTime(),
          });
          done();
        } catch (assertionError) {
          done(assertionError);
        }
      });
    });

    it('returns read errors before formatting message stats', function (done) {
      const error = new Error('find failed');
      const { service, statFind } = loadMessageStatService();
      statFind.returns(
        queryResult([], error) as unknown as ReturnType<typeof statFind>,
      );

      service.readMessageStatsOfUser(
        'user-id',
        new Date('2026-02-01T00:00:00Z').getTime(),
        function (err?: Error | null) {
          try {
            if (!err) throw new Error('Expected read error');
            err.should.equal(error);
            done();
          } catch (assertionError) {
            done(assertionError);
          }
        },
      );
    });

    it('returns read errors from formatted message stats', function (done) {
      const error = new Error('find failed');
      const { service } = loadMessageStatService();
      sinon.stub(service, 'readMessageStatsOfUser').callsArgWith(2, error);

      service.readFormattedMessageStatsOfUser(
        'user-id',
        new Date('2026-02-01T00:00:00Z').getTime(),
        function (err?: Error | null) {
          try {
            should(err).equal(error);
            done();
          } catch (assertionError) {
            done(assertionError);
          }
        },
      );
    });
  });
});
