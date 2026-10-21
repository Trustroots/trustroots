import { disableUserContentLinks } from '@/modules/core/client/utils/rich-text';

const disableExternalLinks = (content: string) =>
  disableUserContentLinks(content, true);

describe('message links', () => {
  it.each([
    '/safety',
    `${window.location.origin}/rules`,
    'https://trustroots.org/circles',
    'https://www.trustroots.org/faq',
    'http://trustroots.org/profile/fictional',
    'http://www.trustroots.org/rules',
    '//www.trustroots.org/safety',
    'https://WWW.TRUSTROOTS.ORG/faq',
  ])('keeps the Trustroots destination %s clickable', href => {
    const content = `<p><a href="${href}"><b>Guidance</b></a></p>`;
    expect(disableExternalLinks(content)).toBe(content);
  });

  it.each([
    'https://outside.example/',
    'https://trustroots.org.example.com/safety',
    'https://www.trustroots.org.example.com/',
    'https://othertrustroots.org/',
    'https://trustroots.org@outside.example/',
    'https://unrelated.trustroots.org/',
    'ftp://trustroots.org/',
    'mailto:member@trustroots.org',
    'javascript:alert(1)',
    'http://[',
    '',
  ])('shows the destination %s as text', href => {
    expect(
      disableExternalLinks(`<p><a href="${href}"><b>Guidance</b></a></p>`),
    ).toBe('<p><b>Guidance</b></p>');
  });

  it('preserves the label of a link without a destination', () => {
    expect(disableExternalLinks('<a>Guidance</a>')).toBe('Guidance');
  });
});
