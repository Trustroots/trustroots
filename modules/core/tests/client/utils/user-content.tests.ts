import { disableUserContentLinks } from '@/modules/core/client/utils/rich-text';

describe('disableUserContentLinks', () => {
  it.each([
    'https://example.org/notes',
    '//example.org/notes',
    '/profile/fictional-member',
    'notes',
    '#notes',
    'mailto:member@example.org',
    'tel:+15555550123',
    'http://[',
    'javascript:alert(1)',
    '',
  ])('preserves the label and formatting without the destination %s', href => {
    expect(
      disableUserContentLinks(
        `<p>Read <a href="${href}"><b>these notes</b></a>.</p>`,
      ),
    ).toBe('<p>Read <b>these notes</b>.</p>');
  });

  it('unwraps anchors without destinations and preserves other content', () => {
    expect(disableUserContentLinks('<p><a>Notes</a><br><i>More</i></p>')).toBe(
      '<p>Notes<br><i>More</i></p>',
    );
    expect(disableUserContentLinks('<ul><li>Plain note</li></ul>')).toBe(
      '<ul><li>Plain note</li></ul>',
    );
    expect(disableUserContentLinks('')).toBe('');
  });
});
