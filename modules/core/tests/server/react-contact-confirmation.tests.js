const request = require('supertest');
const mongoose = require('mongoose');
const express = require('../../../../config/lib/express');
const utils = require('../../../../testutils/server/data.server.testutil');
const User = mongoose.model('User');
require('should');

describe('Extracted React route responses', function () {
  let agent;
  before(() => {
    agent = request.agent(express.init(mongoose.connection));
  });
  afterEach(utils.clearDatabase);
  it('redirects guests to sign in', async () => {
    await agent
      .get('/contact-confirm/665000000000000000000090')
      .expect(302)
      .expect(
        'Location',
        '/signin?continue=true&returnTo=%2Fcontact-confirm%2F665000000000000000000090',
      );
  });
  it('renders the React root for the extracted pages', async () => {
    const credentials = {
      username: 'sampleconfirmmember',
      password: 'SamplePassword123',
    };
    await new User({
      ...credentials,
      firstName: 'Sample',
      lastName: 'Member',
      email: 'sample-confirm@example.test',
      provider: 'local',
      public: true,
    }).save();
    await utils.signIn(credentials, agent);
    for (const path of ['/contact-confirm/665000000000000000000090']) {
      const response = await agent.get(path).expect(200);
      response.text.should.containEql('id="tr-react-root"');
      response.text.should.containEql('assets/react-main.js');
      response.text.should.not.containEql('data-ui-view');
    }
  });
});
