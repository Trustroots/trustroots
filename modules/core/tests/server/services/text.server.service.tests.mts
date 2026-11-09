import textService, * as textExports from '../../../server/services/text.server.service.mts';

import 'should';

/**
 * Text sanitisation tests
 */
describe('Text processor tests', function () {
  it('shares its functions and options through default and named ESM exports', function () {
    for (const name of [
      'html',
      'isEmpty',
      'plainText',
      'sanitizeOptions',
      'stripContactDetails',
    ] as const) {
      textService[name].should.equal(textExports[name]);
    }
  });

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
    describe('Link handling', function () {
      it('Should remove links without href attributes', function () {
        const testString = textService.html('<a>http://trustroots.org</a>');
        testString.should.equal('');
      });

      it('removes links whose text is only whitespace', function () {
        textService
          .html('foo <a href="http://trustroots.org"> </a> bar')
          .should.equal('foo  bar');
      });

      it('links email addresses and phone numbers', function () {
        textService
          .html('mail member@example.org or call (555) 666-7777')
          .should.equal(
            'mail <a href="mailto:member@example.org">member@example.org</a> or call <a href="tel:5556667777">(555) 666-7777</a>',
          );
      });

      it('shortens long link text in the middle', function () {
        const path = 'a'.repeat(200);
        textService
          .html(`https://example.org/${path}`)
          .should.equal(
            `<a href="https://example.org/${path}">example.org/${'a'.repeat(62)}…${'a'.repeat(73)}</a>`,
          );
      });
    });

    describe('Whitespace from editors', function () {
      it('turns non-breaking spaces and empty paragraphs into spaces and trims the ends', function () {
        textService
          .html('  <b>a</b>&nbsp;<i>b</i><p><br></p><u>c</u>  ')
          .should.equal('<b>a</b> <i>b</i> <u>c</u>');
      });

      it('returns an empty string for empty or editor-empty content', function () {
        textService.html('').should.equal('');
        textService.html(null).should.equal('');
        textService.html(' &nbsp; <p><br></p> ').should.equal('');
      });
    });
  });

  describe('Sanitize plain text', function () {
    it('Remove all html tags from a string', function () {
      const testString = textService.plainText(htmlString, false);
      const htmlOutput =
        'Foofoofoofoofoofoolinku with paramsh1h2h3h4h5h6 unclosed tagfoo\nbar';
      testString.should.equal(htmlOutput);
    });

    it('turns self-closing and spaced line breaks into newlines', function () {
      textService.plainText('a<br/>b<br />c<BR>d').should.equal('a\nb\nc\nd');
    });

    it('replaces each whitespace character with a space only when asked', function () {
      textService.plainText('a\tb<br>c', true).should.equal('a b c');
      textService.plainText('a\tb<br>c').should.equal('a\tb\nc');
    });

    it('returns an empty string for empty values', function () {
      textService.plainText('').should.equal('');
      textService.plainText(undefined).should.equal('');
    });
  });

  describe('Strip contact details', function () {
    it('returns an empty string for empty content', function () {
      textService
        .stripContactDetails(null as unknown as string)
        .should.equal('');
    });

    it('removes detected URLs, email addresses and phone numbers', function () {
      const stripped = textService.stripContactDetails(
        '<p>Write to member@example.org, call (555) 666-7777, or visit https://example.org/profile. Welcome!</p>',
      );

      stripped.should.equal('Write to , call , or visit . Welcome!');
    });

    it('removes contact links with custom labels', function () {
      textService
        .stripContactDetails(
          '<p>Use <a href="mailto:member@example.org">this address</a> or <a href="https://example.org/profile">my page</a>.</p>',
        )
        .should.equal('Use  or .');
    });

    it('removes http, ftp and protocol-relative links but keeps site-relative ones', function () {
      textService
        .stripContactDetails(
          '<a href="http://example.org">site</a>|<a href="ftp://example.org">files</a>|<a href="tel:5556667777">phone</a>|<a href="//example.org">relative</a>|<a href="/go?to=https://example.org">my page</a>',
        )
        .should.equal('||||my page');
    });

    it('keeps text of other tags even when they carry a link-like href', function () {
      textService
        .stripContactDetails('<b href="https://example.org">bold</b>')
        .should.equal('bold');
    });
  });
});
