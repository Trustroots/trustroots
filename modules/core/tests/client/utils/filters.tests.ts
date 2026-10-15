import {
  plainText,
  plainTextLength,
} from '@/modules/core/client/utils/filters';

describe('client filter utilities', () => {
  it('turns html into plain text', () => {
    expect(plainText('<p>Hello <strong>there</strong></p>')).toBe(
      'Hello there',
    );
    expect(plainText(null)).toBe('');
    expect(plainText({ text: '<p>Hello</p>' })).toBe('');
  });

  it('counts trimmed plain text characters', () => {
    expect(plainTextLength('<p>  Welcome home  </p>')).toBe(12);
  });

  it('keeps encoded markup literal and ignores empty elements', () => {
    expect(plainText('&lt;img src=x&gt;<b>Text</b>')).toBe('<img src=x>Text');
    expect(plainText('<br>')).toBe('');
  });

  it('returns empty text when document cannot create elements', () => {
    const originalCreateElementDescriptor = Object.getOwnPropertyDescriptor(
      document,
      'createElement',
    );

    try {
      Object.defineProperty(document, 'createElement', {
        configurable: true,
        value: undefined,
      });

      expect(plainText('<p>Hello</p>')).toBe('');
    } finally {
      if (originalCreateElementDescriptor) {
        Object.defineProperty(
          document,
          'createElement',
          originalCreateElementDescriptor,
        );
      } else {
        Reflect.deleteProperty(document, 'createElement');
      }
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});
