import AppConfig from '@/modules/core/client/app/config';
import '@/modules/users/client/users.client.module';

describe('tr-memberships-list directive', function () {
  let $compile;
  let $rootScope;

  beforeEach(angular.mock.module(AppConfig.appModuleName));

  beforeEach(inject(function (_$compile_, _$rootScope_) {
    $compile = _$compile_;
    $rootScope = _$rootScope_;
  }));

  function compileDirective(memberships, isOwnProfile = false) {
    const scope = $rootScope.$new();
    scope.memberships = memberships;
    scope.isOwnProfile = isOwnProfile;

    const element = $compile(
      '<div tr-memberships-list="memberships" is-own-profile="isOwnProfile"></div>',
    )(scope);
    scope.$digest();

    return {
      element,
      scope: element.isolateScope(),
    };
  }

  it('initializes list limit and caps displayed memberships', function () {
    const memberships = [
      { tribe: { slug: 'one', count: 1 } },
      { tribe: { slug: 'two', count: 2 } },
      { tribe: { slug: 'three', count: 3 } },
      { tribe: { slug: 'four', count: 4 } },
      { tribe: { slug: 'five', count: 5 } },
      { tribe: { slug: 'six', count: 6 } },
      { tribe: { slug: 'seven', count: 7 } },
    ];

    const { element, scope } = compileDirective(memberships, true);

    expect(scope.tribeListLimit).toBe(5);
    expect(element.find('li.tribe').length).toBe(5);
    expect(element.find('.panel-more-fade').length).toBe(1);
  });

  it('expands the limit when toggled', function () {
    const memberships = [
      { tribe: { slug: 'one', count: 1 } },
      { tribe: { slug: 'two', count: 2 } },
      { tribe: { slug: 'three', count: 3 } },
      { tribe: { slug: 'four', count: 4 } },
      { tribe: { slug: 'five', count: 5 } },
      { tribe: { slug: 'six', count: 6 } },
    ];

    const { element, scope } = compileDirective(memberships, true);
    const reveal = element.find('.panel-more-fade');

    expect(reveal.length).toBe(1);

    reveal.triggerHandler('click');
    scope.$digest();

    expect(scope.tribeListLimit).toBeUndefined();
    expect(element.find('li.tribe').length).toBe(6);
    expect(element.find('.panel-more-fade').length).toBe(0);
  });

  it('shows a helpful empty-state for own profile', function () {
    const { element } = compileDirective([], true);

    expect(element.text()).toContain(
      'Joining circles helps you find likeminded Trustroots members.',
    );
    expect(element.find('.content-empty').length).toBe(1);
    expect(element.find('a').text().trim()).toBe('Join circles');
  });

  it('hides own-profile CTA when not own profile', function () {
    const { element } = compileDirective([], false);

    expect(element.text()).not.toContain('Joining circles');
    expect(element.find('.text-center').length).toBe(0);
  });

  it('handles empty membership lists safely', function () {
    const { scope } = compileDirective(undefined, false);

    expect(scope.memberships).toBeUndefined();
    expect(scope.tribeListLimit).toBe(5);
    expect(scope.toggle).toEqual(jasmine.any(Function));
  });
});
