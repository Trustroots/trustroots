const should = require('should');
const nunjucks = require('nunjucks');
const jsonForScript = require('../../../server/services/json-for-script.server.service');

describe('Bootstrap JSON formatting', () => {
  it('round-trips text with HTML delimiters and Unicode separators', () => {
    const value = { name: '</script><p>Sample & text</p>\u2028\u2029' };
    const encoded = jsonForScript(value);
    encoded.should.not.match(/[<>&\u2028\u2029]/);
    JSON.parse(encoded).should.deepEqual(value);
  });

  it('preserves primitive values and empty input', () => {
    should(jsonForScript(undefined)).equal('null');
    should(jsonForScript(null)).equal('null');
    jsonForScript(false).should.equal('false');
    jsonForScript(42).should.equal('42');
  });

  it('keeps bootstrap strings inside their script element', () => {
    const templates = new nunjucks.Environment();
    templates.addFilter('jsonForScript', jsonForScript);
    const html = templates.renderString(
      '<script>var user = {{ user | jsonForScript | safe }};</script>',
      { user: { name: '</script><p>Sample</p>' } },
    );
    html.match(/<\/script>/g).should.have.length(1);
    html.should.not.containEql('<p>');
  });
});
