import '@/modules/messages/client/messages.client.module';
import '@/modules/messages/client/directives/unread-count.client.directive';
import AppConfig from '@/modules/core/client/app/config';

describe('messagesUnreadCount directive', function () {
  let $compile;
  let $rootScope;
  let Authentication;
  let PollMessagesCount;

  beforeEach(function () {
    Authentication = {
      user: null,
    };
    PollMessagesCount = {
      getUnreadCount: jasmine
        .createSpy('PollMessagesCount.getUnreadCount')
        .and.returnValue(0),
      initPolling: jasmine.createSpy('PollMessagesCount.initPolling'),
      poll: jasmine.createSpy('PollMessagesCount.poll'),
    };

    angular.mock.module(AppConfig.appModuleName, function ($provide) {
      $provide.value('Authentication', Authentication);
      $provide.value('PollMessagesCount', PollMessagesCount);
    });
  });

  beforeEach(inject(function (_$compile_, _$rootScope_) {
    $compile = _$compile_;
    $rootScope = _$rootScope_;
  }));

  beforeEach(function () {
    document.head.innerHTML = `
      <link id="favicon" href="/img/favicon.png">
      <link id="favicon2x" href="/img/favicon@2x.png">
    `;
  });

  afterEach(function () {
    document.head.innerHTML = '';
  });

  function compileDirective() {
    const scope = $rootScope.$new();
    const element = $compile('<span messages-unread-count></span>')(scope);
    scope.$digest();

    return {
      element,
      scope: element.scope(),
    };
  }

  it('starts polling immediately for authenticated public members', function () {
    Authentication.user = {
      public: true,
    };
    PollMessagesCount.getUnreadCount.and.returnValue(2);

    const { element, scope } = compileDirective();

    expect(scope.unread).toBe(2);
    expect(element.hasClass('notification-badge')).toBe(true);
    expect(PollMessagesCount.initPolling).toHaveBeenCalled();
    expect(PollMessagesCount.poll).toHaveBeenCalled();
  });

  it('waits for a public user before starting unread polling', function () {
    Authentication.user = {
      public: false,
    };

    const { scope } = compileDirective();

    expect(PollMessagesCount.initPolling).not.toHaveBeenCalled();
    expect(PollMessagesCount.poll).not.toHaveBeenCalled();

    Authentication.user.public = true;
    scope.$broadcast('userUpdated');

    expect(PollMessagesCount.initPolling).toHaveBeenCalled();
    expect(PollMessagesCount.poll).toHaveBeenCalled();
  });

  it('keeps waiting when user updates remain non-public', function () {
    Authentication.user = {
      public: false,
    };

    const { scope } = compileDirective();

    scope.$broadcast('userUpdated');

    expect(PollMessagesCount.initPolling).not.toHaveBeenCalled();
    expect(PollMessagesCount.poll).not.toHaveBeenCalled();

    Authentication.user.public = true;
    scope.$broadcast('userUpdated');

    expect(PollMessagesCount.initPolling).toHaveBeenCalledTimes(1);
    expect(PollMessagesCount.poll).toHaveBeenCalledTimes(1);
  });

  it('updates the badge and favicons when unread counts change', function () {
    Authentication.user = {
      public: true,
    };
    const { scope } = compileDirective();

    scope.$broadcast('unreadCountUpdated', 3);

    expect(scope.unread).toBe(3);
    expect(document.getElementById('favicon')).toHaveProperty(
      'href',
      `${window.location.origin}/img/favicon-notification.png`,
    );
    expect(document.getElementById('favicon2x')).toHaveProperty(
      'href',
      `${window.location.origin}/img/favicon-notification@2x.png`,
    );

    scope.$broadcast('unreadCountUpdated', 0);

    expect(scope.unread).toBe(0);
    expect(document.getElementById('favicon')).toHaveProperty(
      'href',
      `${window.location.origin}/img/favicon.png`,
    );
    expect(document.getElementById('favicon2x')).toHaveProperty(
      'href',
      `${window.location.origin}/img/favicon@2x.png`,
    );
  });
});
