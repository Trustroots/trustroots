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
    const originalDocument = global.document;

    try {
      Object.defineProperty(global, 'document', {
        configurable: true,
        value: {
          createElement: jest.fn(() => ({
            innerHTML: '',
            textContent: '',
            innerText: 'Fallback text',
          })),
        },
      });

      expect(plainText('<p>Fallback text</p>')).toBe('Fallback text');
    } finally {
      Object.defineProperty(global, 'document', {
        configurable: true,
        value: originalDocument,
      });
    }
  });

  it('returns empty text when generated element has no text fields', () => {
    const originalDocument = global.document;

    try {
      Object.defineProperty(global, 'document', {
        configurable: true,
        value: {
          createElement: jest.fn(() => ({
            innerHTML: '',
            textContent: '',
            innerText: '',
          })),
        },
      });

      expect(plainText('<br>')).toBe('');
    } finally {
      Object.defineProperty(global, 'document', {
        configurable: true,
        value: originalDocument,
      });
    }
  });

  it('returns empty text when document is unavailable', () => {
    const originalDocument = global.document;

    try {
      Object.defineProperty(global, 'document', {
        configurable: true,
        value: undefined,
      });

      expect(plainText('<p>Hello</p>')).toBe('');
    } finally {
      Object.defineProperty(global, 'document', {
        configurable: true,
        value: originalDocument,
      });
    }
  });
});
