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

  it('uses the minimum generated file size for very small local avatars', function () {
    const { element } = compileTemplate(
      {
        _id: 'u2-small',
        avatarUploaded: true,
        avatarSource: 'local',
      },
      'source="local" size="16"',
    );

    expect(element.find('img').attr('src')).toContain(
      '/uploads-profile/u2-small/avatar/32.jpg?',
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

  it('uses facebook source URL when provider is configured', function () {
    const { element } = compileTemplate(
      {
        displayName: 'Facebook User',
        avatarSource: 'facebook',
        additionalProvidersData: {
          facebook: {
            id: 'fb-987',
          },
        },
      },
      'source="facebook"',
    );

    const src = element.find('img').attr('src');
    expect(src).toContain('graph.facebook.com');
    expect(src).toContain('fb-987');
  });

  it('uses default facebook image dimensions when size is reset before source refresh', function () {
    const { element, scope } = compileTemplate(
      {
        displayName: 'Facebook User',
        avatarSource: 'facebook',
        additionalProvidersData: {
          facebook: {
            id: 'fb-default-size',
          },
        },
      },
      'source="facebook"',
    );

    element.isolateScope().size = undefined;
    scope.user.updated = '2026-06-06T08:00:00.000Z';
    scope.$digest();

    const src = element.find('img').attr('src');
    expect(src).toContain('fb-default-size');
    expect(src).toContain('width=256');
    expect(src).toContain('height=256');
  });

  it('falls back to default avatar when facebook source is missing provider data', function () {
    const { element } = compileTemplate(
      {
        displayName: 'Missing FB',
        avatarSource: 'facebook',
      },
      'source="facebook"',
    );

    expect(element.find('img').attr('src')).toBe('/img/avatar.png');
  });

  it('falls back to default avatar when facebook provider id is missing', function () {
    const { element } = compileTemplate(
      {
        displayName: 'Missing FB ID',
        avatarSource: 'facebook',
        additionalProvidersData: {
          facebook: {},
        },
      },
      'source="facebook"',
    );

    expect(element.find('img').attr('src')).toBe('/img/avatar.png');
  });

  it('uses gravatar URL when email hash is available', function () {
    const { element } = compileTemplate(
      {
        displayName: 'Gravatar',
        avatarSource: 'gravatar',
        emailHash: 'abcd1234',
      },
      'source="gravatar"',
    );

    const src = element.find('img').attr('src');
    expect(src).toContain('gravatar.com/avatar/abcd1234');
    expect(src).toContain('s=256');
  });

  it('uses default gravatar image size when size is reset before source refresh', function () {
    const { element, scope } = compileTemplate(
      {
        displayName: 'Gravatar',
        avatarSource: 'gravatar',
        emailHash: 'defaultsize123',
      },
      'source="gravatar"',
    );

    element.isolateScope().size = '';
    scope.user.updated = '2026-06-06T08:00:00.000Z';
    scope.$digest();

    const src = element.find('img').attr('src');
    expect(src).toContain('gravatar.com/avatar/defaultsize123');
    expect(src).toContain('s=256');
  });

  it('falls back to default avatar when gravatar hash is missing', function () {
    const { element } = compileTemplate(
      {
        displayName: 'Gravatar',
        avatarSource: 'gravatar',
      },
      'source="gravatar"',
    );

    expect(element.find('img').attr('src')).toBe('/img/avatar.png');
  });

  it('uses local fallback avatar when user data is not sufficient', function () {
    const { element } = compileTemplate(
      {
        displayName: 'Local User',
        avatarSource: 'local',
        avatarUploaded: true,
      },
      'source="local"',
    );

    expect(element.find('img').attr('src')).toBe('/img/avatar.png');
  });

  it('uses default none source when no user is supplied', function () {
    const { element } = compileTemplate(null);

    expect(element.find('img').attr('src')).toBe('/img/avatar.png?none');
  });
});
