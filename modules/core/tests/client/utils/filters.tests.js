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
    expect(plainText({ text: '<p>Hello</p>' })).toBe('');
  });

  it('counts trimmed plain text characters', () => {
    expect(plainTextLength('<p>  Welcome home  </p>')).toBe(12);
  });

  it('falls back to innerText when textContent is empty', () => {
    jest.spyOn(document, 'createElement').mockReturnValue({
      innerHTML: '',
      textContent: '',
      innerText: 'Fallback text',
    });

    expect(plainText('<p>Fallback text</p>')).toBe('Fallback text');
  });

  it('returns empty text when generated element has no text fields', () => {
    jest.spyOn(document, 'createElement').mockReturnValue({
      innerHTML: '',
      textContent: '',
      innerText: '',
    });

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
        delete document.createElement;
      }
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});
