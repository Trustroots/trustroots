import request from 'supertest';
import mongoose from 'mongoose';
import express from './../../../../config/lib/express.mts';
import config from './../../../../config/config.mts';
import 'should';

type SparkPostEvent = {
  msys: {
    message_event: {
      type: string;
      campaign_id: string;
      timestamp: string;
    };
  };
};

/**
 * Globals
 */
let app: import('express').Express;
let agent: ReturnType<typeof request.agent>;
let events: SparkPostEvent[];

/**
 * Sparkpost routes tests
 */
describe('Sparkpost CRUD tests', function () {
  describe('Webhook endpoint', function () {
    before(function (done) {
      (async () => {
        // Get application
        app = await express.init(mongoose.connection);
        agent = request.agent(app);

        // Sparkpost webhook event example
        events = [
          {
            msys: {
              message_event: {
                type: 'delivery',
                campaign_id: 'example',
                timestamp: '1454442600',
              },
            },
          },
        ];
        done();
      })().catch(done);
    });
    it('Should not be allowed to access endpoint without credentials', function (done) {
      agent
        .post('/api/sparkpost/webhook')
        .expect(401)
        .end(function (err, res) {
          res.headers['www-authenticate'].should.equal(
            'Basic realm="Knock Knock"',
          );
          res.body.message.should.equal('Access denied');

          // Call the assertion callback
          return done(err);
        });
    });
    it('Should be allowed to access endpoint with credentials', function (done) {
      agent
        .post('/api/sparkpost/webhook')
        .auth(
          config.sparkpostWebhook.username,
          config.sparkpostWebhook.password,
        )
        .send(events)
        .expect(200)
        .end(done);
    });
  });
});
