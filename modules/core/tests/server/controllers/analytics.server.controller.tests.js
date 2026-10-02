const analytics = require('../../../server/controllers/analytics.server.controller');
const winston = require('winston');

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

    it('logs only UTM presence when validation fails', function () {
      const originalLog = winston.log;
      const calls = [];
      winston.log = function () {
        calls.push(Array.from(arguments));
      };
      const privateUrl =
        'https://example.test/reset?token=private-token&email=person@example.test';

      try {
        analytics.appendUTMParams(privateUrl, {
          source: 'private-source-value',
        });
      } finally {
        winston.log = originalLog;
      }

      const loggedArguments = calls[0];

      loggedArguments[0].should.equal('error');
      loggedArguments[1].should.equal(
        'utmTrackify() missing one of the required variables.',
      );
      loggedArguments[2].should.eql({
        hasTrackUrl: true,
        hasSource: true,
        hasMedium: false,
        hasCampaign: false,
      });
      JSON.stringify(loggedArguments).should.not.containEql('private-token');
      JSON.stringify(loggedArguments).should.not.containEql(
        'private-source-value',
      );
    });
  });
});
