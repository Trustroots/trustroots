import 'should';
import jsonForScript from './../../../server/services/json-for-script.server.service.mts';

describe('Bootstrap JSON formatting', () => {
  it('round-trips text with HTML delimiters and Unicode separators', () => {
    const value = { name: '</script><p>Sample & text</p>\u2028\u2029' };
    const encoded = jsonForScript(value);
    encoded.should.not.match(/[<>&\u2028\u2029]/);
    JSON.parse(encoded).should.deepEqual(value);
  });

  it('writes a missing template value as null', () => {
    jsonForScript(undefined).should.equal('null');
  });
});
