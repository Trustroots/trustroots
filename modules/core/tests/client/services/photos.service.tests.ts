import photos, {
  selectPhoto,
} from '@/modules/core/client/services/photos.service';

describe('board photos service', () => {
  const originalInnerWidth = window.innerWidth;

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: originalInnerWidth,
    });
  });

  it('selects the desktop photo by default', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1024,
    });

    expect(selectPhoto('jungleroad')).toEqual({
      ...photos.jungleroad,
      imageUrl: '/img/board/jungleroad.jpg',
    });
  });

  it('selects the mobile photo for narrow screens', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 480,
    });

    expect(selectPhoto('jungleroad')).toEqual({
      ...photos.jungleroad,
      imageUrl: '/img/board/jungleroad--mobile.jpg',
    });
  });
});
