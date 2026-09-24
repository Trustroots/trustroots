const request = require('supertest');
const mongoose = require('mongoose');
const express = require('../../../../config/lib/express');
const utils = require('../../../../testutils/server/data.server.testutil');
const User = mongoose.model('User');
require('should');

describe('React contact creation route responses', function () {
  let agent;
  before(() => {
    agent = request.agent(express.init(mongoose.connection));
  });
  afterEach(utils.clearDatabase);
  it('redirects guests to sign in', async () => {
    for (const path of [
      '/contact-add/665000000000000000000090',
      '/profile/sample-member/experiences/new',
    ]) {
      await agent
        .get(path)
        .expect(302)
        .expect(
          'Location',
          `/signin?continue=true&returnTo=${encodeURIComponent(path)}`,
        );
    }
  });
  it('renders the React root for the extracted pages', async () => {
    const credentials = {
      username: 'sampleaddmember',
      password: 'SamplePassword123',
    };
    await new User({
      ...credentials,
      firstName: 'Sample',
      lastName: 'Member',
      email: 'sample-add@example.test',
      provider: 'local',
      public: true,
    }).save();
    await utils.signIn(credentials, agent);
    for (const path of [
      '/contact-add/665000000000000000000090',
      '/profile/sample-member/experiences/new',
    ]) {
      const response = await agent.get(path).expect(200);
      response.text.should.containEql('id="tr-react-root"');
      response.text.should.containEql('assets/react-main.js');
      response.text.should.not.containEql('data-ui-view');
    }
  });
});
