const path = require('path');
const textService = require(path.resolve(
  './modules/core/server/services/text.server.service',
));

require('should');

/**
 * Statistics routes tests
 */
describe('Text processor tests', function () {
  const htmlString =
    'Foo' +
    '<i>foo</i>' +
    '<u>foo</u>' +
    '<em>foo</em>' +
    '<strong>foo</strong>' +
    '<b>foo</b>' +
    '<a href="http://www.trustroots.org" target="_blank" data-test="foo">link</a>' +
    '<script>alert()</script>' +
    '<iframe src="http://www.trustroots.org"></iframe>' +
    '<u onload="alert()" style="background:red">u with params</u>' +
    '<h1>h1</h1>' +
    '<h2>h2</h2>' +
    '<h3>h3</h3>' +
    '<h4>h4</h4>' +
    '<h5>h5</h5>' +
    '<h6>h6</h6>' +
    '&nbsp;' +
    '<img src="//www.trustroots.org/img/avatar.png"/>' +
    '<p>unclosed tag' +
    '<p>foo<br>bar</p>';

  describe('Sanitize html', function () {
    it('Should strip trailing empty space', function () {
      const testString = textService.html('foo  	');
      testString.should.equal('foo');
    });

    it('Replace &nbsp; with empty spaces', function () {
      const testString = textService.html('foo&nbsp;bar');
      testString.should.equal('foo bar');
    });

    it('Replace <p><br></p> with empty spaces', function () {
      const testString = textService.html('foo<p><br></p>bar');
      testString.should.equal('foo bar');
    });

    it('Remove non-allowed tags and keep allowed ones', function () {
      const htmlOutput =
        'Foo' +
        '<i>foo</i>' +
        '<u>foo</u>' +
        '<i>foo</i>' +
        '<b>foo</b>' +
        '<b>foo</b>' +
        '<a href="http://www.trustroots.org">link</a>' +
        '<u>u with params</u>' +
        'h1' +
        'h2' +
        'h3' +
        'h4' +
        'h5' +
        'h6' +
        ' ' +
        '<p>unclosed tag</p>' +
        '<p>foo<br />bar</p>';

      const testString = textService.html(htmlString);
      testString.should.equal(htmlOutput);
    });

    describe('Link handling', function () {
      it('Should allow protocol relative links', function () {
        const testString = textService.html(
          '<a href="//www.trustroots.org">test</a>',
        );
        testString.should.equal('<a href="//www.trustroots.org">test</a>');
      });

      it('Should allow "http:" links', function () {
        const testString = textService.html(
          '<a href="http://www.trustroots.org">www.trustroots.org</a>',
        );
        testString.should.equal(
          '<a href="http://www.trustroots.org">www.trustroots.org</a>',
        );
      });

      it('Should allow "https:" links', function () {
        const testString = textService.html(
          '<a href="https://www.trustroots.org">www.trustroots.org</a>',
        );
        testString.should.equal(
          '<a href="https://www.trustroots.org">www.trustroots.org</a>',
        );
      });

      it('Should allow "geo:" links', function () {
        const testString = textService.html(
          '<a href="geo:37.786971,-122.399677">37.786971,-122.399677</a>',
        );
        testString.should.equal(
          '<a href="geo:37.786971,-122.399677">37.786971,-122.399677</a>',
        );
      });

      it('Should allow "mailto:" links', function () {
        const testString = textService.html(
          '<a href="mailto:test@example.com">test@example.com</a>',
        );
        testString.should.equal(
          '<a href="mailto:test@example.com">test@example.com</a>',
        );
      });

      it('Should allow "tel:" links', function () {
        const testString = textService.html(
          '<a href="tel:555-2368">555-2368</a>',
        );
        testString.should.equal('<a href="tel:555-2368">555-2368</a>');
      });

      describe('Automatic linking', function () {
        it('Should not autolink mentions', function () {
          const testString = textService.html('foo @trustroots bar');
          testString.should.equal('foo @trustroots bar');
        });

        it('Should not autolink #hashtags', function () {
          const testString = textService.html('foo #trustroots bar');
          testString.should.equal('foo #trustroots bar');
        });

        it('Should autolink phone numbers', function () {
          const testString = textService.html('foo (555)666-7777 bar');
          testString.should.equal(
            'foo <a href="tel:5556667777">(555)666-7777</a> bar',
          );
        });

        it('Should autolink email addresses', function () {
          const testString = textService.html('foo foo@example.com bar');
          testString.should.equal(
            'foo <a href="mailto:foo@example.com">foo@example.com</a> bar',
          );
        });

        [
          {
            scheme: 'http',
            in: 'http://www.example.com',
            out: '<a href="http://www.example.com">www.example.com</a>',
          },
          {
            scheme: 'https',
            in: 'https://www.example.com',
            out: '<a href="https://www.example.com">www.example.com</a>',
          },
          {
            scheme: 'ftp',
            in: 'ftp://example.com',
            out: '<a href="ftp://example.com">ftp://example.com</a>',
          },
          {
            scheme: 'sftp',
            in: 'sftp://example.com',
            out: '<a href="sftp://example.com">sftp://example.com</a>',
          },
          {
            scheme: 'irc',
            in: 'irc://example.com:80/channel?key',
            out: '<a href="irc://example.com:80/channel?key">irc://example.com:80/channel?key</a>',
          },
          {
            scheme: 'ge0 (Maps.me)',
            in: 'ge0://w4aP1NSjwS/My_Position',
            out: '<a href="ge0://w4aP1NSjwS/My_Position">ge0://w4aP1NSjwS/My_Position</a>',
          },
          {
            scheme: 'tg (Telegram)',
            in: 'tg://resolve?domain=trustroots',
            out: '<a href="tg://resolve?domain=trustroots">tg://resolve?domain=trustroots</a>',
          },
        ].forEach(function (schemeTest) {
          it(
            'Should autolink whitelisted URL scheme: ' + schemeTest.scheme,
            function () {
              const testString = textService.html(schemeTest.in);
              testString.should.equal(schemeTest.out);
            },
          );
        });

        it('Should not autolink "file" URL scheme', function () {
          const testString = textService.html('file://host/path');
          testString.should.equal('');
        });

        it('Should not autolink non-whitelisted URL schemes', function () {
          const testString = textService.html('bad://www.trustroots.org');
          testString.should.equal('');
        });

        it('Should allow autolinking protocol relative urls', function () {
          const testString = textService.html('//www.trustroots.org');
          testString.should.equal(
            '<a href="//www.trustroots.org">www.trustroots.org</a>',
          );
        });

        it('Should remove https:// from link contents and keep it at href when autolinking', function () {
          const testString = textService.html(
            'foo https://www.trustroots.org bar',
          );
          testString.should.equal(
            'foo <a href="https://www.trustroots.org">www.trustroots.org</a> bar',
          );
        });

        it('Should remove http:// from link contents and keep it at href when autolinking', function () {
          const testString = textService.html(
            'foo http://www.trustroots.org bar',
          );
          testString.should.equal(
            'foo <a href="http://www.trustroots.org">www.trustroots.org</a> bar',
          );
        });

        it('Should strip trailing slash from links when autolinking', function () {
          const testString = textService.html(
            'foo http://www.trustroots.org/faq/ bar',
          );
          testString.should.equal(
            'foo <a href="http://www.trustroots.org/faq/">www.trustroots.org/faq</a> bar',
          );
        });
      });
    });
  });

  describe('Test for empty strings', function () {
    it('Should return true for an empty string', function () {
      const testString = textService.isEmpty('');
      testString.should.equal(true);
    });

    it('Should return false for an non-empty string', function () {
      const testString = textService.isEmpty('Hey!');
      testString.should.equal(false);
    });

    it('Should return true for a string containing only spaces, newlines and tabs', function () {
      const testString = textService.isEmpty('  \n\n		');
      testString.should.equal(true);
    });

    it('Should return true for string containing only html tags', function () {
      const testString = textService.isEmpty('<p><br></p>');
      testString.should.equal(true);
    });

    it('Should return true for string containing only &nbsp;', function () {
      const testString = textService.isEmpty('&nbsp;&nbsp;');
      testString.should.equal(true);
    });

    it('Should return true for string containing only br tags', function () {
      const testString = textService.isEmpty('<br><br/>');
      testString.should.equal(true);
    });
  });

  describe('Sanitize plain text', function () {
    it('Remove all html tags from a string', function () {
      const testString = textService.plainText(htmlString);
      const htmlOutput =
        'Foofoofoofoofoofoolinku with paramsh1h2h3h4h5h6 unclosed tagfoo\nbar';
      testString.should.equal(htmlOutput);
    });

    it('Remove all html tags and odd empty spaces from a string', function () {
      const htmlInput = '4-spaces:    4-tabs:				4-newlines:\n\n\n\n- end';
      const htmlOutput = '4-spaces:    4-tabs:    4-newlines:    - end';
      const testString = textService.plainText(htmlInput, true);
      testString.should.equal(htmlOutput);
    });

    it('Should replace br tags with newlines', function () {
      const testString = textService.plainText('foo<br>bar');
      testString.should.equal('foo\nbar');
    });

    it('Should strip trailing and leading empty space', function () {
      const testString = textService.plainText('   foo  	');
      testString.should.equal('foo');
    });

    it('Should not leave html entity codes', function () {
      const testString = textService.plainText('> foo & ©');
      testString.should.equal('> foo & ©');
    });

    it('Should clean out html entity codes in safe way', function () {
      const testString = textService.plainText(
        '&lt;p&gt;alert();&lt;/p&gt;<p>hello & and < moi &#8230;</p>',
      );
      testString.should.equal('alert();hello & and < moi …');
    });

    it('Should clean out html entity codes, even without ";"', function () {
      const testString = textService.plainText('foo&ampbar');
      testString.should.equal('foo&bar');
    });
  });
});
