import AppConfig from '@/modules/core/client/app/config';
import photos from '@/modules/core/client/services/photos.service';
import '@/modules/core/client/directives/tr-boards.client.directive';

describe('trBoards directive', function () {
  let $compile;
  let $rootScope;
  let originalRandom;
  let originalWindowInnerWidth;

  beforeEach(function () {
    originalWindowInnerWidth = window.innerWidth;
    window.innerWidth = 1024;
    originalRandom = Math.random;

    angular.mock.module(AppConfig.appModuleName, function ($provide) {
      // Use the real window from test environment so Angular input helpers work.
      $provide.value('$window', window);
    });
  });

  beforeEach(inject(function (_$compile_, _$rootScope_) {
    $compile = _$compile_;
    $rootScope = _$rootScope_;
  }));

  afterEach(function () {
    window.innerWidth = originalWindowInnerWidth;
    Math.random = originalRandom;
  });

  function compile(board) {
    const scope = $rootScope.$new();
    scope.board = board;

    const element = $compile('<div tr-boards="board"></div>')(scope);
    scope.$digest();

    return { element, scope };
  }

  function emitPhotoCredits(onScope) {
    const spy = jasmine.createSpy('photoCreditsUpdated');
    onScope.$on('photoCreditsUpdated', (_event, value) => {
      spy(value);
    });
    return spy;
  }

  it('uses direct board key and emits photo metadata', function () {
    const scope = $rootScope.$new();
    const onPhotoCreditsUpdated = emitPhotoCredits(scope);
    scope.board = 'forestpath';

    const element = $compile('<div tr-boards="board"></div>')(scope);
    scope.$digest();

    expect(element.hasClass('board-forestpath')).toBe(true);
    expect(element.css('background-image')).toContain(photos.forestpath.file);
    expect(onPhotoCreditsUpdated).toHaveBeenCalledWith({
      forestpath: jasmine.objectContaining(photos.forestpath),
    });
  });

  it('falls back to the default photo when requested key is missing', function () {
    const { element } = compile('does-not-exist');

    expect(element.hasClass('board-does-not-exist')).toBe(true);
    expect(element.css('background-image')).toContain(photos.bokeh.file);
  });

  it('skips desktop image setup on small screens when ignored', function () {
    window.innerWidth = 320;
    const spy = jasmine.createSpy('photoCreditsUpdated');
    const scope = $rootScope.$new();
    scope.board = 'forestpath';

    scope.$on('photoCreditsUpdated', (_event, value) => {
      spy(value);
    });

    const element = $compile(
      '<div tr-boards="board" tr-boards-ignore-small></div>',
    )(scope);
    scope.$digest();

    expect(element.hasClass('board-forestpath')).toBe(false);
    expect(element.css('background-image')).toBe('');
    expect(spy).not.toHaveBeenCalled();
  });

  it('uses mobile image variant on narrow screens when provided', function () {
    window.innerWidth = 320;
    const { element } = compile('rainbowpeople');

    expect(element.css('background-image')).toContain(
      photos.rainbowpeople.file_mobile,
    );
  });

  it('handles array input by selecting one valid board key', function () {
    spyOn(Math, 'random').and.returnValue(0.99);

    const { element } = compile(['hitchroad', 'forestpath']);

    // With random=0.99 and two options, the second key is selected.
    expect(element.hasClass('board-forestpath')).toBe(true);
    expect(element.css('background-image')).toContain(photos.forestpath.file);

    // keep global Math.random stable for other suites
    Math.random = originalRandom;
  });
});
