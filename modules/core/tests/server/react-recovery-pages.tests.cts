const request: typeof import('supertest') = require('supertest');
const mongoose: typeof import('mongoose') = require('mongoose');
const express: import('../../../../testutils/server/model-contracts.mts').TestExpressModule = require('./../../../../config/lib/express.mjs');
const utils = require('../../../../testutils/server/data.server.testutil');
require('should');
describe('Extracted React route responses', function () {
  let agent: import('../../../../testutils/server/model-contracts.mts').TestAgent;
  before(async () => {
    agent = request.agent(await express.init(mongoose.connection));
  });
  afterEach(utils.clearDatabase);
  it('renders the React root for the extracted pages', async () => {
    for (const path of [
      '/password/forgot?userhandle=sample',
      '/password/reset/success',
      '/password/reset/invalid',
      '/confirm-email-invalid',
    ]) {
      const response = await agent.get(path).expect(200);
      response.text.should.containEql('id="tr-react-root"');
      response.text.should.containEql('assets/react-main.js');
      response.text.should.not.containEql('data-ui-view');
    }
  });
});
