import { plainTextLength } from '@/modules/offers/client/components/offerEdit.helpers';

describe('offer description length', () => {
  it('counts visible text and decodes character references', () => {
    expect(plainTextLength('<p>  Meet &amp; chat  </p>')).toBe(11);
    expect(plainTextLength('<p>one</p><p>two</p>')).toBe(6);
  });

  it('uses the HTML parser for nested markup and angle brackets', () => {
    expect(plainTextLength('<b title=">">Hello</b>')).toBe(5);
    expect(plainTextLength('2 < 3')).toBe(5);
  });

  it('accepts empty descriptions', () => {
    expect(plainTextLength()).toBe(0);
    expect(plainTextLength('<p></p>')).toBe(0);
  });
});
