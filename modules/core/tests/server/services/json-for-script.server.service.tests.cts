const jsonForScript = require('./../../../server/services/json-for-script.server.service.mts');

describe('Bootstrap JSON formatting', () => {
  it('exposes the same function through the ESM entry point', async () => {
    const { default: esmJsonForScript } =
      await import('../../../server/services/json-for-script.server.service.mts');
    esmJsonForScript.should.equal(jsonForScript);
  });

  it('round-trips text with HTML delimiters and Unicode separators', () => {
    const value = { name: '</script><p>Sample & text</p>\u2028\u2029' };
    const encoded = jsonForScript(value);
    encoded.should.not.match(/[<>&\u2028\u2029]/);
    JSON.parse(encoded).should.deepEqual(value);
  });
});
