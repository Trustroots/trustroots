import {
  limitTo,
  plainText,
  plainTextLength,
} from '@/modules/core/client/utils/filters';

describe('client filter utilities', () => {
  it('limits text to the requested length', () => {
    expect(limitTo('Trustroots', 5)).toBe('Trust');
  });

  it('turns html into plain text', () => {
    expect(plainText('<p>Hello <strong>there</strong></p>')).toBe(
      'Hello there',
    );
    expect(plainText(null)).toBe('');
  });

  it('counts trimmed plain text characters', () => {
    expect(plainTextLength('<p>  Welcome home  </p>')).toBe(12);
  });
});
