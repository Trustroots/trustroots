import AppConfig from '@/modules/core/client/app/config';

describe('messageCenterService', function () {
  let $rootScope;
  let $sce;
  let $timeout;
  let messageCenterService;
  let messageCenterServiceProvider;

  beforeEach(
    angular.mock.module(
      AppConfig.appModuleName,
      function ($messageCenterServiceProvider) {
        messageCenterServiceProvider = $messageCenterServiceProvider;
      },
    ),
  );

  beforeEach(inject(function (
    _$rootScope_,
    _$sce_,
    _$timeout_,
    _messageCenterService_,
  ) {
    $rootScope = _$rootScope_;
    $sce = _$sce_;
    $timeout = _$timeout_;
    messageCenterService = _messageCenterService_;
  }));

  afterEach(function () {
    messageCenterService.reset();
    messageCenterServiceProvider.setGlobalOptions({ timeout: 6000 });
  });

  it('adds info messages with unseen state and processed flag', function () {
    const message = messageCenterService.add('info', 'Greetings');

    expect(message.type).toBe('info');
    expect(message.status).toBe('unseen');
    expect(message.processed).toBe(false);
    expect(message.html).toBe(false);
  });

  it('uses custom global options and per-message status without timeouts', function () {
    messageCenterServiceProvider.setGlobalOptions({
      status: 'next',
      timeout: undefined,
    });

    const message = messageCenterService.add('info', 'Until next page');

    expect(messageCenterServiceProvider.getOptions()).toEqual({
      status: 'next',
      timeout: undefined,
    });
    expect(message.status).toBe('next');
    expect(message.timer).toBeUndefined();
  });

  it('trusts html message bodies when requested', function () {
    const rawMessage = '<strong>Hello</strong>';
    const message = messageCenterService.add('warning', rawMessage, {
      html: true,
    });

    expect(message.html).toBe(true);
    expect($sce.getTrustedHtml(message.message)).toBe(rawMessage);
  });

  it('throws on invalid message types', function () {
    expect(() => {
      messageCenterService.add('invalid', 'Nope');
    }).toThrow('Invalid message type');
  });

  it('auto-hides messages after timeout', function () {
    messageCenterService.add('success', 'Temporary', { timeout: 50 });

    expect(messageCenterService.mcMessages).toHaveLength(1);
    $timeout.flush(50);

    expect(messageCenterService.mcMessages).toHaveLength(0);
  });

  it('calls close() to remove a message', function () {
    const message = messageCenterService.add('warning', 'Close me');

    expect(messageCenterService.mcMessages).toHaveLength(1);
    message.close();

    expect(messageCenterService.mcMessages).toHaveLength(0);
  });

  it('marks unseen messages as shown in bulk', function () {
    messageCenterService.add('success', 'One');
    messageCenterService.add('success', 'Two');
    messageCenterService.mcMessages[0].status = 'unseen';
    messageCenterService.mcMessages[1].status = 'next';

    messageCenterService.markShown();

    expect(messageCenterService.mcMessages[0].status).toBe('shown');
    expect(messageCenterService.mcMessages[0].processed).toBe(true);
    expect(messageCenterService.mcMessages[1].status).toBe('unseen');
  });

  it('leaves permanent and already processed messages unchanged when marking shown', function () {
    const processed = messageCenterService.add('info', 'Processed');
    const permanent = messageCenterService.add('info', 'Permanent', {
      status: 'permanent',
    });
    processed.processed = true;
    processed.status = 'unseen';

    messageCenterService.markShown();

    expect(processed.status).toBe('unseen');
    expect(permanent.status).toBe('permanent');
    expect(permanent.processed).toBe(false);
  });

  it('removes messages with shown status', function () {
    const shown = messageCenterService.add('info', 'Hide me');
    shown.status = 'shown';
    messageCenterService.add('info', 'Keep');

    messageCenterService.removeShown();

    expect(messageCenterService.mcMessages).toHaveLength(1);
    expect(messageCenterService.mcMessages[0].message).toBe('Keep');
  });

  it('flushes messages to root scope', function () {
    const message = messageCenterService.add('danger', 'Broadcast');

    messageCenterService.flush();

    expect($rootScope.mcMessages).toContain(message);
  });

  it('resets all messages', function () {
    messageCenterService.add('info', 'One');
    messageCenterService.add('warning', 'Two');

    messageCenterService.reset();

    expect(messageCenterService.mcMessages).toHaveLength(0);
  });
});
