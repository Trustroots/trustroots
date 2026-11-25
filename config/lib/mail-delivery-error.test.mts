import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MailDeliveryError, mailFailure } from './mail-delivery-error.mts';

test('classifies temporary SMTP replies and transient transport failures', () => {
  for (const details of [
    { code: 'EENVELOPE', command: 'RCPT TO', responseCode: 450 },
    { code: 'EMESSAGE', responseCode: 421 },
    { code: 'ETIMEDOUT' },
    { code: 'EDNS', originalCode: 'EAI_AGAIN' },
    { code: 'ESOCKET', originalCode: 'ECONNRESET' },
    { code: 'ECONNREFUSED' },
    { code: 'ETLS', originalCode: 'ECONNRESET' },
  ]) {
    const error = new MailDeliveryError(details);
    assert.equal(error.retryable, true);
    assert.equal(error.message, mailFailure.temporary);
  }
});

test('distinguishes recipient rejection, permanent message rejection and configuration', () => {
  for (const details of [
    { command: 'RCPT TO', responseCode: 550, reason: mailFailure.recipient },
    { code: 'EMESSAGE', responseCode: 554, reason: mailFailure.permanent },
    { code: 'ESOCKET', responseCode: 554, reason: mailFailure.permanent },
    { code: 'EAUTH', responseCode: 535, reason: mailFailure.configuration },
    {
      code: 'EDNS',
      originalCode: 'ENOTFOUND',
      reason: mailFailure.configuration,
    },
    { code: 'ETLS', reason: mailFailure.configuration },
    {
      command: 'MAIL FROM',
      responseCode: 550,
      reason: mailFailure.configuration,
    },
    {
      message: 'ECONNRESET in an unstructured or sensitive error',
      reason: mailFailure.unknown,
    },
  ]) {
    const error = new MailDeliveryError(details);
    assert.equal(error.retryable, false);
    assert.equal(error.message, details.reason);
  }
});

test('reports temporary authentication failure as configuration and retries it', () => {
  const error = new MailDeliveryError({ code: 'EAUTH', responseCode: 454 });
  assert.equal(error.retryable, true);
  assert.equal(error.message, mailFailure.configuration);
  assert.equal(error.responseCode, 454);
});
