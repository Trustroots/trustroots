const analytics = require('../../../server/controllers/analytics.server.controller');

require('should');

describe('Controller: analytics', function () {
  describe('appendUTMParams', function () {
    const utmParams = {
      source: 'transactional_email',
      medium: 'email',
      campaign: 'password_reset_email',
    };

    it('appends the required UTM parameters', function () {
      const result = analytics.appendUTMParams(
        'https://www.trustroots.org/',
        utmParams,
      );
      result.should.containEql('utm_source=transactional_email');
      result.should.containEql('utm_medium=email');
      result.should.containEql('utm_campaign=password_reset_email');
    });

    it('appends optional term and content parameters', function () {
      const result = analytics.appendUTMParams('https://www.trustroots.org/', {
        ...utmParams,
        term: 'running shoes',
        content: 'textlink',
      });
      result.should.containEql('utm_term=running%20shoes');
      result.should.containEql('utm_content=textlink');
    });

    it('preserves existing query parameters', function () {
      const result = analytics.appendUTMParams(
        'https://www.trustroots.org/?foo=bar',
        utmParams,
      );
      result.should.containEql('foo=bar');
      result.should.containEql('utm_source=transactional_email');
    });

    it('returns the original URL when UTM params are missing', function () {
      const result = analytics.appendUTMParams('https://www.trustroots.org/', {
        source: 'transactional_email',
      });
      result.should.equal('https://www.trustroots.org/');
    });

    it('returns the original URL when the UTM params object is missing', function () {
      const result = analytics.appendUTMParams('https://www.trustroots.org/');
      result.should.equal('https://www.trustroots.org/');
    });

    it('returns an empty string when no URL is given', function () {
      const result = analytics.appendUTMParams('', {
        source: 'transactional_email',
      });
      result.should.equal('');
    });

    it('returns an empty string when neither URL nor UTM params are given', function () {
      const result = analytics.appendUTMParams();
      result.should.equal('');
    });
  });
});
