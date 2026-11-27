const transientCodes = new Set([
  'EAI_AGAIN',
  'ECONNECTION',
  'ECONNABORTED',
  'ECONNREFUSED',
  'ECONNRESET',
  'EDNS',
  'EHOSTUNREACH',
  'ENETDOWN',
  'ENETRESET',
  'ENETUNREACH',
  'EPIPE',
  'ESOCKET',
  'ETIMEOUT',
  'ETIMEDOUT',
]);
const configurationCodes = new Set([
  'EAUTH',
  'ECONFIG',
  'ENOAUTH',
  'EOAUTH2',
  'EREQUIRETLS',
  'ETLS',
  'EMAIL_POLICY_TRANSPORT',
]);
const permanentNetworkCodes = new Set([
  'ENOTFOUND',
  'ENODATA',
  'CERT_HAS_EXPIRED',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
]);

export const mailFailure = {
  temporary: 'Mail temporarily unavailable',
  configuration: 'Mail authentication or configuration failure',
  recipient: 'Mail recipient permanently rejected',
  permanent: 'Mail permanently rejected',
  unknown: 'Mail processing failed',
} as const;

export const mailRetriesExhausted = 'Mail retries exhausted';

export class MailDeliveryError extends Error {
  readonly retryable: boolean;
  readonly responseCode?: number;

  constructor(error: unknown) {
    const smtp = error as {
      code?: string;
      originalCode?: string;
      responseCode?: number;
      command?: string;
    } | null;
    const code = smtp?.code ?? '';
    const originalCode = smtp?.originalCode ?? '';
    const responseCode = smtp?.responseCode;
    const validReply =
      typeof responseCode === 'number' &&
      Number.isInteger(responseCode) &&
      responseCode >= 400 &&
      responseCode <= 599
        ? responseCode
        : undefined;
    const temporaryReply = validReply !== undefined && validReply < 500;
    const temporaryNetworkCause =
      validReply === undefined && transientCodes.has(originalCode);
    const configurationFailure =
      permanentNetworkCodes.has(code) ||
      permanentNetworkCodes.has(originalCode) ||
      (!temporaryNetworkCause && configurationCodes.has(code)) ||
      (typeof smtp?.command === 'string' && smtp.command.startsWith('AUTH ')) ||
      validReply === 530 ||
      validReply === 535 ||
      (validReply !== undefined &&
        !temporaryReply &&
        smtp?.command === 'MAIL FROM');
    const transient =
      temporaryReply ||
      temporaryNetworkCause ||
      (validReply === undefined && transientCodes.has(code));
    const message = classifyFailure(
      configurationFailure,
      transient,
      validReply,
      smtp?.command,
    );
    // Agenda and the worker persist and log error.message. Keep raw SMTP replies
    // and the original Error out of the object entirely.
    super(message);
    this.responseCode = validReply;
    this.retryable = temporaryReply || message === mailFailure.temporary;
  }
}

function classifyFailure(
  configurationFailure: boolean,
  transient: boolean,
  responseCode: number | undefined,
  command: string | undefined,
) {
  if (configurationFailure) return mailFailure.configuration;
  if (transient) return mailFailure.temporary;
  if (responseCode === undefined) return mailFailure.unknown;
  if (command === 'RCPT TO') return mailFailure.recipient;
  return mailFailure.permanent;
}
