import '@/modules/tribes/client/tribes.client.module';
import AppConfig from '@/modules/core/client/app/config';
import { canUseWebP } from '@/modules/core/client/utils/dom';
import { getCircleBackgroundUrl } from '@/modules/tribes/client/utils';

jest.mock('@/modules/core/client/utils/dom', () => ({
  canUseWebP: jest.fn(() => false),
}));

jest.mock('@/modules/tribes/client/utils', () => ({
  getCircleBackgroundUrl: jest.fn(
    () => 'https://cdn.trustroots.io/circle-bg.webp',
  ),
}));

describe('Tribe-related directives', function () {
  let $compile;
  let $rootScope;
  let Authentication;
  let TribeService;
  let $state;

  beforeEach(
    angular.mock.module(AppConfig.appModuleName, function ($provide) {
      Authentication = {
        user: {
          memberIds: ['one', 'other'],
        },
      };
      TribeService = {
        fillCache: jasmine.createSpy('TribeService.fillCache'),
      };
      $state = {
        go: jasmine.createSpy('state.go'),
        get: jasmine.createSpy('state.get').and.returnValue([]),
        href: jasmine.createSpy('state.href').and.returnValue('/'),
        current: {
          name: 'circle',
        },
      };

      $provide.value('TribeService', TribeService);
      $provide.value('Authentication', Authentication);
      $provide.value('$state', $state);
    }),
  );

  beforeEach(inject(function (_$compile_, _$rootScope_) {
    $compile = _$compile_;
    $rootScope = _$rootScope_;
  }));

  function compile(template, scopeData = {}) {
    const scope = $rootScope.$new();
    Object.assign(scope, scopeData);
    const element = $compile(template)(scope);
    scope.$digest();

    return element;
  }

  describe('trTribeStyles directive', function () {
    it('skips style updates when required attrs are missing', function () {
      const element = compile(
        '<div tr-tribe-styles tr-tribe-styles-dimensions="1024x768"></div>',
      );

      expect(element.attr('style')).toBeUndefined();
    });

    it('applies background image and color styles', function () {
      const element = compile(
        '<div tr-tribe-styles=\'{"slug":"circle","image":"hero.jpg","color":"ff00ff"}\' tr-tribe-styles-dimensions="320x240"></div>',
      );

      expect(canUseWebP).toHaveBeenCalled();
      expect(getCircleBackgroundUrl).toHaveBeenCalledWith(
        'circle',
        '320x240',
        'jpg',
      );
      expect(element.attr('style')).toContain('background-image:url');
      expect(element.attr('style')).toContain('background-color:#ff00ff');
    });
  });

  describe('trTribeBadge directive', function () {
    it('opens tribe page and caches tribe object', function () {
      const tribe = { slug: 'circle', _id: 'tid' };
      const element = compile('<div tr-tribe-badge="tribe"></div>', { tribe });
      const directive = element.controller('trTribeBadge');

      directive.openTribe();

      expect(TribeService.fillCache).toHaveBeenCalledWith(
        jasmine.objectContaining({ _id: 'tid', slug: 'circle' }),
      );
      expect($state.go).toHaveBeenCalledWith('circles.circle', {
        circle: 'circle',
      });
    });
  });

  describe('trTribesInCommon directive', function () {
    it('collects only memberships also available for signed-in user', function () {
      const scopeData = {
        memberships: [
          { tribe: { _id: 'one', slug: 'one' }, label: 'One' },
          { tribe: { _id: 'two', slug: 'two' }, label: 'Two' },
        ],
      };

      const element = compile(
        '<div tr-tribes-in-common="memberships"></div>',
        scopeData,
      );

      const directive = element.controller('trTribesInCommon');

      expect(directive.memberships).toEqual([scopeData.memberships[0]]);
      directive.openTribe(scopeData.memberships[0].tribe);
      expect(TribeService.fillCache).toHaveBeenCalledWith(
        scopeData.memberships[0].tribe,
      );
      expect($state.go).toHaveBeenCalledWith('circles.circle', {
        circle: 'one',
      });
    });
  });
});
