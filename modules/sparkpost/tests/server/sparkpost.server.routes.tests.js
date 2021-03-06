const request = require('supertest');
const path = require('path');
const mongoose = require('mongoose');
const express = require(path.resolve('./config/lib/express'));
const config = require(path.resolve('./config/config'));

/**
 * Sparkpost routes tests
 */
describe('Sparkpost CRUD tests', () => {
  const app = express.init(mongoose.connection);
  const agent = request.agent(app);

  // Sparkpost webhook event example
  const events = [
    {
      msys: {
        message_event: {
          type: 'delivery',
          campaign_id: 'example',
          timestamp: '1454442600',
          mailbox_provider: 'Gsuite',
          reason: 'MAIL REFUSED - IP (a.b.c.d) is in black list',
        },
      },
    },
  ];

  describe('Webhook endpoint', () => {
    it('Should not be able to request using GET method', async () => {
      await agent.get('/api/sparkpost/webhook').expect(404);
    });

    it('Should not be allowed to access endpoint without credentials', async () => {
      const { body, headers } = await agent
        .post('/api/sparkpost/webhook')
        .expect(401);

      headers['www-authenticate'].should.equal('Basic realm="Knock Knock"');
      body.message.should.equal('Access denied');
    });

    it('Should not be allowed to access endpoint with wrong credentials', async () => {
      await agent
        .post('/api/sparkpost/webhook')
        .auth('wrong', 'wrong')
        .expect(401);
    });

    it('Should be allowed to access endpoint with credentials', async () => {
      await agent
        .post('/api/sparkpost/webhook')
        .auth(
          config.sparkpostWebhook.username,
          config.sparkpostWebhook.password,
        )
        .send(events)
        .expect(200);
    });
  });
});
