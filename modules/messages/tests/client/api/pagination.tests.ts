import { nextPageParams } from '../../../client/api/pagination';

describe('message pagination', () => {
  it.each([
    undefined,
    null,
    false,
    42,
    '',
    'invalid',
    '<http://[invalid]>; rel="next"',
  ])('ignores an unusable header: %s', header => {
    expect(nextPageParams(header)).toBeUndefined();
  });

  it('retains the existing header length limit', () => {
    expect(nextPageParams('<' + 'a'.repeat(1986) + '>; rel="next"')).toEqual(
      {},
    );
    expect(
      nextPageParams('<' + 'a'.repeat(1987) + '>; rel="next"'),
    ).toBeUndefined();
  });

  it.each([
    '/api/messages?before=cursor-1&limit=10',
    'https://example.test/api/messages?before=cursor-1&limit=10',
    '?before=cursor-1&limit=10',
  ])('extracts query parameters from %s', url => {
    expect(nextPageParams(`<${url}>; rel="next"`)).toEqual({
      before: 'cursor-1',
      limit: '10',
    });
  });

  it('decodes query values and preserves repeated values and empty parameters', () => {
    expect(
      nextPageParams(
        '</api/messages?tag=one&tag=two&tag=three&before=a%2Bb+c&empty&bad=%ZZ>; rel="next"',
      ),
    ).toEqual({
      tag: ['one', 'two', 'three'],
      before: 'a+b c',
      empty: '',
      bad: '%ZZ',
    });
  });

  it('selects the next relation among several links', () => {
    expect(
      nextPageParams(
        '</api/messages?page=1>; rel="prev", </api/messages?page=3>; rel="next", </api/messages?page=9>; rel="last"',
      ),
    ).toEqual({ page: '3' });
  });

  it('accepts unquoted and multiple relations, using the last next link', () => {
    expect(
      nextPageParams(
        '</api/messages?page=2>; rel=next, </api/messages?page=3>; rel="next last"',
      ),
    ).toEqual({ page: '3' });
  });

  it('preserves link attributes overriding query values, excluding rel and url', () => {
    expect(
      nextPageParams(
        '</api/messages?limit=5&rel=prev&url=ignored>; rel="next"; limit="10"; title="More"; ignored',
      ),
    ).toEqual({ limit: '10', title: 'More' });
  });

  it('does not select links with no next relation', () => {
    expect(nextPageParams('</api/messages>; title="More"')).toBeUndefined();
    expect(nextPageParams('</api/messages>; rel="prev"')).toBeUndefined();
    expect(nextPageParams('</api/messages?rel=prev&rel=last>')).toBeUndefined();
  });

  it('ignores fragments and preserves prototype-like query keys as own fields', () => {
    expect(
      nextPageParams(
        '</api/messages?__proto__=value&constructor=other#ignored>; rel="next"',
      ),
    ).toEqual(JSON.parse('{"__proto__":"value","constructor":"other"}'));
  });
});
