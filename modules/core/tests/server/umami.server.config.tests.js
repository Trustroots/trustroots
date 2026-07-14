const developmentConfig = require('../../../../config/env/development');
const productionConfig = require('../../../../config/env/production');
const testConfig = require('../../../../config/env/test');
require('should');

describe('Umami configuration', function () {
  const scriptSrc = 'https://1p.trustroots.org/script.js';
  const developmentAndTestWebsiteId = '6c518160-cd10-4233-a3e4-4491ee387a01';
  const productionWebsiteId = '23ec0c85-2ebc-4d85-9063-c23d90b8ded1';

  it('uses the development and test website for non-production environments', function () {
    developmentConfig.umami.scriptSrc.should.equal(scriptSrc);
    developmentConfig.umami.websiteId.should.equal(developmentAndTestWebsiteId);
    testConfig.umami.scriptSrc.should.equal(scriptSrc);
    testConfig.umami.websiteId.should.equal(developmentAndTestWebsiteId);
  });

  it('keeps production analytics separate', function () {
    productionConfig.umami.scriptSrc.should.equal(scriptSrc);
    productionConfig.umami.websiteId.should.equal(productionWebsiteId);
    productionConfig.umami.websiteId.should.not.equal(
      developmentAndTestWebsiteId,
    );
  });
});
