const analytics = require('./../../../server/controllers/analytics.server.controller.mjs');
const winston = require('winston');

require('should');

describe('Controller: analytics', function () {
  describe('appendUTMParams', function () {
    const utmParams = {
      source: 'transactional_email',
      medium: 'email',
      campaign: 'password_reset_email',
    };

    it('appends optional term and content parameters', function () {
      const result = analytics.appendUTMParams('https://www.trustroots.org/', {
        ...utmParams,
        term: 'running shoes',
        content: 'textlink',
      });
      result.should.containEql('utm_term=running%20shoes');
      result.should.containEql('utm_content=textlink');
    });

    it('appends only the required parameters when optional ones are absent', function () {
      analytics
        .appendUTMParams('https://www.trustroots.org/search?q=a#top', utmParams)
        .should.equal(
          'https://www.trustroots.org/search?q=a&utm_source=transactional_email&utm_medium=email&utm_campaign=password_reset_email#top',
        );
    });

    it('keeps relative URLs relative', function () {
      analytics
        .appendUTMParams('/profile/edit?tab=about#photo', utmParams)
        .should.equal(
          '/profile/edit?tab=about&utm_source=transactional_email&utm_medium=email&utm_campaign=password_reset_email#photo',
        );
    });

    it('logs which required UTM params are present when the source is missing', function () {
      const originalLog = winston.log;
      const calls: unknown[][] = [];
      winston.log = function (...args: unknown[]) {
        calls.push(args);
      };
      try {
        analytics
          .appendUTMParams('https://www.trustroots.org/', {
            medium: 'email',
            campaign: 'password_reset_email',
          })
          .should.equal('https://www.trustroots.org/');
      } finally {
        winston.log = originalLog;
      }
      calls.length.should.equal(1);
      (calls[0][2] as Record<string, boolean>).should.eql({
        hasTrackUrl: true,
        hasSource: false,
        hasMedium: true,
        hasCampaign: true,
      });
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

    it('returns the original URL when it cannot be parsed', function () {
      const result = analytics.appendUTMParams('http://', utmParams);
      result.should.equal('http://');
    });

    it('logs only UTM presence when validation fails', function () {
      const originalLog = winston.log;
      const calls: [
        level: string,
        message: string,
        details: Record<string, boolean>,
      ][] = [];
      winston.log = function (
        level: string,
        message: string,
        details: Record<string, boolean>,
      ) {
        calls.push([level, message, details]);
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
