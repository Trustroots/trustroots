import * as domUtils from '@/modules/core/client/utils/dom';
import {
  getCircleBackgroundUrl,
  getCircleBackgroundStyle,
} from '@/modules/tribes/client/utils';

describe('tribes utils', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('builds circle background URLs with explicit format', () => {
    expect(getCircleBackgroundUrl('circle-1', '742x496', 'jpg')).toBe(
      '/uploads-circle/circle-1/742x496.jpg',
    );
    expect(getCircleBackgroundUrl('circle-1', '742x496', 'webp')).toBe(
      '/uploads-circle/circle-1/742x496.webp',
    );
  });

  it('builds style with image and color using webp when supported', () => {
    jest.spyOn(domUtils, 'canUseWebP').mockReturnValue(true);

    const style = getCircleBackgroundStyle(
      { slug: 'circle-2', image: true, color: 'aa00ff' },
      '640x480',
    );

    expect(style.backgroundImage).toBe(
      'url(/uploads-circle/circle-2/640x480.webp)',
    );
    expect(style.backgroundColor).toBe('#aa00ff');
  });

  it('builds style with image and color using jpg when webp is not supported', () => {
    jest.spyOn(domUtils, 'canUseWebP').mockReturnValue(false);

    const style = getCircleBackgroundStyle(
      { slug: 'circle-3', image: true, color: '00aa55' },
      '640x480',
    );

    expect(style.backgroundImage).toBe(
      'url(/uploads-circle/circle-3/640x480.jpg)',
    );
    expect(style.backgroundColor).toBe('#00aa55');
  });

  it('returns color-only style when no image URL is available', () => {
    jest.spyOn(domUtils, 'canUseWebP').mockReturnValue(true);

    const style = getCircleBackgroundStyle(
      { slug: 'circle-4', color: 'ff5500' },
      '320x200',
    );

    expect(style).toEqual({ backgroundColor: '#ff5500' });
  });

  it('returns empty style when no image or color is provided', () => {
    jest.spyOn(domUtils, 'canUseWebP').mockReturnValue(false);

    const style = getCircleBackgroundStyle({ slug: 'circle-5' }, '320x200');

    expect(style).toEqual({});
  });
});
