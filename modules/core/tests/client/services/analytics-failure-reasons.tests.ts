import {
  emailConfirmFailureReason,
  messageSendFailureReason,
  passwordResetFailureReason,
  saveFailureReason,
  signinFailureReason,
} from '@trustroots/analytics/client';

const withStatus = (status: unknown) => ({ response: { status } });

describe('analytics failure reasons', () => {
  it('reads only a numeric response status', () => {
    [
      null,
      undefined,
      'request failed',
      new Error('offline'),
      { response: null },
      withStatus('400'),
    ].forEach(error => {
      expect(signinFailureReason(error)).toBe('server');
      expect(emailConfirmFailureReason(error)).toBe('server');
      expect(passwordResetFailureReason(error)).toBe('server');
      expect(messageSendFailureReason(error)).toBe('other');
      expect(saveFailureReason(error)).toBe('server');
    });
  });

  it('maps sign-in statuses', () => {
    expect(signinFailureReason(withStatus(400))).toBe('credentials');
    expect(signinFailureReason(withStatus(403))).toBe('suspended');
    expect(signinFailureReason(withStatus(429))).toBe('rate_limited');
    expect(signinFailureReason(withStatus(503))).toBe('server');
  });

  it('maps link statuses', () => {
    expect(emailConfirmFailureReason(withStatus(400))).toBe('invalid_link');
    expect(emailConfirmFailureReason(withStatus(500))).toBe('server');
    expect(passwordResetFailureReason(withStatus(400))).toBe('invalid_link');
    expect(passwordResetFailureReason(withStatus(429))).toBe('rate_limited');
    expect(passwordResetFailureReason(withStatus(503))).toBe('server');
  });

  it('maps message and save statuses', () => {
    expect(messageSendFailureReason(withStatus(429))).toBe('rate_limited');
    expect(messageSendFailureReason(withStatus(403))).toBe('other');
    [400, 413, 415].forEach(status =>
      expect(saveFailureReason(withStatus(status))).toBe('validation'),
    );
    [403, 429, 500].forEach(status =>
      expect(saveFailureReason(withStatus(status))).toBe('server'),
    );
  });
});
