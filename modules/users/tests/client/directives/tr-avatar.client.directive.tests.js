import AppConfig from '@/modules/core/client/app/config';
import '@/modules/users/client/directives/tr-avatar.client.directive';

describe('trAvatar directive', function () {
  let $compile;
  let $rootScope;

  beforeEach(angular.mock.module(AppConfig.appModuleName));

  beforeEach(inject(function (_$compile_, _$rootScope_) {
    $compile = _$compile_;
    $rootScope = _$rootScope_;
  }));

  function compileTemplate(user, attributes) {
    const scope = $rootScope.$new();
    scope.user = user;

    const element = $compile(
      `<div tr-avatar user="user" ${attributes || ''}></div>`,
    )(scope);
    scope.$digest();

    return {
      element,
      scope,
    };
  }

  it('renders linked fallback avatar by default', function () {
    const { element } = compileTemplate({
      _id: 'u1',
      displayName: 'Guest',
      avatarSource: 'none',
    });

    expect(element.find('a').length).toBe(1);
    expect(element.find('img').length).toBe(1);
    expect(element.find('img').attr('src')).toContain('/img/avatar.png?none');
    expect(element.find('a').attr('aria-label')).toBe(
      'Open user profile for Guest',
    );
  });

  it('renders local uploads with proper size and cache busting', function () {
    const expectedTimestamp = new Date('2026-05-15T12:00:00.000Z').getTime();

    const { element } = compileTemplate(
      {
        _id: 'u2',
        avatarUploaded: true,
        avatarSource: 'local',
        updated: '2026-05-15T12:00:00.000Z',
      },
      'source="local" size="64"',
    );

    expect(element.find('a').length).toBe(1);
    expect(element.find('img').attr('src')).toContain(
      `/uploads-profile/u2/avatar/64.jpg?${expectedTimestamp}`,
    );
  });

  it('locks explicit source and ignores later user source changes', function () {
    const { element, scope } = compileTemplate(
      {
        _id: 'u3',
        displayName: 'User',
        avatarSource: 'local',
        avatarUploaded: true,
      },
      'source="local" size="32"',
    );

    expect(element.find('img').attr('src')).toContain(
      '/uploads-profile/u3/avatar/32.jpg?',
    );

    scope.user.avatarSource = 'facebook';
    scope.user.updated = '2026-05-15T12:00:00.000Z';
    scope.$digest();

    expect(element.find('img').attr('src')).toContain(
      '/uploads-profile/u3/avatar/32.jpg?',
    );
  });

  it('uses the default fallback for unknown sources without user data', function () {
    const { element } = compileTemplate({
      _id: 'u4',
      displayName: 'Empty',
      avatarSource: 'mystery',
    });

    expect(element.find('img').attr('src')).toBe('/img/avatar.png?none');
  });

  it('does not render link when link flag is false', function () {
    const { element } = compileTemplate(
      {
        _id: 'u5',
      },
      'link="false"',
    );

    expect(element.find('a').length).toBe(0);
    expect(element.find('img').length).toBe(1);
  });
});
