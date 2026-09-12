const request = require('supertest');
const mongoose = require('mongoose');
const express = require('../../../../config/lib/express');
const utils = require('../../../../testutils/server/data.server.testutil');
require('should');

describe('Extracted React route responses', function () {
  let agent;
  before(() => {
    agent = request.agent(express.init(mongoose.connection));
  });
  afterEach(utils.clearDatabase);
  it('renders the React root for the extracted pages', async () => {
    for (const path of ['/', '/safety']) {
      const response = await agent.get(path).expect(200);
      response.text.should.containEql('id="tr-react-root"');
      response.text.should.containEql('assets/react-main.js');
      response.text.should.not.containEql('data-ui-view');
    }
  });
});
