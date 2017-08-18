'use strict';

var path = require('path'),
    textProcessor = require(path.resolve('./modules/core/server/controllers/text-processor.server.controller'));

require('should');

/**
 * Statistics routes tests
 */
describe('Text processor tests', function() {

  var htmlString = 'Foo' +
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
    '<img src="//www.trustroots.org/modules/users/img/avatar.png"/>' +
    '<p>unclosed tag' +
    '<p>foo<br>bar</p>';

  describe('Sanitize', function() {
    it('Should strip trailing empty space', function() {
      var testString = textProcessor.html('foo  	');
      testString.should.equal('foo');
    });

    it('Should not link mentions', function() {
      var testString = textProcessor.html('foo @trustroots bar');
      testString.should.equal('foo @trustroots bar');
    });

    it('Should not link #hashtags', function() {
      var testString = textProcessor.html('foo #trustroots bar');
      testString.should.equal('foo #trustroots bar');
    });

    it('Should link phone numbers', function() {
      var testString = textProcessor.html('foo (555)666-7777 bar');
      testString.should.equal('foo <a href="tel:5556667777">(555)666-7777</a> bar');
    });


    it('Should link email addresses', function() {
      var testString = textProcessor.html('foo foo@example.com bar');
      testString.should.equal('foo <a href="mailto:foo@example.com">foo@example.com</a> bar');
    });

    it('Should remove https:// from link contents and keep it at href', function() {
      var testString = textProcessor.html('foo https://www.trustroots.org bar');
      testString.should.equal('foo <a href="https://www.trustroots.org">www.trustroots.org</a> bar');
    });

    it('Should remove http:// from link contents and keep it at href', function() {
      var testString = textProcessor.html('foo http://www.trustroots.org bar');
      testString.should.equal('foo <a href="http://www.trustroots.org">www.trustroots.org</a> bar');
    });

    it('Should strip trailing slash from links', function() {
      var testString = textProcessor.html('foo http://www.trustroots.org/faq/ bar');
      testString.should.equal('foo <a href="http://www.trustroots.org/faq/">www.trustroots.org/faq</a> bar');
    });

    it('Replace &nbsp; with empty spaces', function() {
      var testString = textProcessor.html('foo&nbsp;bar');
      testString.should.equal('foo bar');
    });

    it('Replace <p><br></p> with empty spaces', function() {
      var testString = textProcessor.html('foo<p><br></p>bar');
      testString.should.equal('foo bar');
    });

    it('Remove non-allowed tags and keep allowed ones', function() {
      var htmlOutput = 'Foo' +
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

      var testString = textProcessor.html(htmlString);
      testString.should.equal(htmlOutput);
    });
  });

  describe('Test for empty strings', function() {

    it('Should return true for an empty string', function() {
      var testString = textProcessor.isEmpty('');
      testString.should.equal(true);
    });

    it('Should return false for an non-empty string', function() {
      var testString = textProcessor.isEmpty('Hey!');
      testString.should.equal(false);
    });

    it('Should return true for a string containing only spaces and tabs', function() {
      var testString = textProcessor.isEmpty('  	');
      testString.should.equal(true);
    });

    it('Should return true for string containing only html tags', function() {
      var testString = textProcessor.isEmpty('<p><br></p>');
      testString.should.equal(true);
    });

    it('Should return true for string containing only &nbsp;', function() {
      var testString = textProcessor.isEmpty('&nbsp;&nbsp;');
      testString.should.equal(true);
    });
  });

  describe('Plain text', function() {

    it('Remove all html tags from a string', function() {
      var testString = textProcessor.plainText(htmlString);
      var htmlOutput = 'Foofoofoofoofoofoolinku with paramsh1h2h3h4h5h6 unclosed tagfoobar';
      testString.should.equal(htmlOutput);
    });

    it('Remove all html tags and odd empty spaces from a string', function() {
      var htmlInput = '4-spaces:    4-tabs:				4-newlines:\n\n\n\n- end';
      var htmlOutput = '4-spaces:    4-tabs:    4-newlines:    - end';
      var testString = textProcessor.plainText(htmlInput, true);
      testString.should.equal(htmlOutput);
    });

    it('Should strip trailing empty space', function() {
      var testString = textProcessor.plainText('   foo  	');
      testString.should.equal('foo');
    });

    it('Should not leave html entity codes', function() {
      var testString = textProcessor.plainText('> foo & ©');
      testString.should.equal('> foo & ©');
    });

    it('Should clean out html entity codes in safe way', function() {
      var testString = textProcessor.plainText('&lt;p&gt;alert();&lt;/p&gt;<p>hello & and < moi &#8230;</p>');
      testString.should.equal('alert();hello & and < moi …');
    });

    it('Should clean out html entity codes, even without ;', function() {
      var testString = textProcessor.plainText('foo&ampbar');
      testString.should.equal('foo&bar');
    });

  });
});
