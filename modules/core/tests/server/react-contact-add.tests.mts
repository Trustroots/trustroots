import request from 'supertest';
import mongoose from 'mongoose';
import express from './../../../../config/lib/express.mts';
import * as utils from './../../../../testutils/server/data.server.testutil.mts';
import 'should';

describe('React contact creation route responses', function () {
  let agent: import('../../../../testutils/server/model-contracts.mts').TestAgent;
  before(async () => {
    agent = request.agent(await express.init(mongoose.connection));
  });
  afterEach(utils.clearDatabase);
  it('renders the React root for the extracted pages', async () => {
    const credentials = {
      username: 'sampleaddmember',
      password: 'SamplePassword123',
    };
    await utils
      .createTestUser({
        ...credentials,
        firstName: 'Sample',
        lastName: 'Member',
        email: 'sample-add@example.test',
      })
      .save();
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
