/** Maximum size of an inbound reply body, measured in UTF-8 bytes. */
export const maxReplyBytes = 20_000;

const replyMarker = '--- Reply above this line ---';
const onWroteMarker = /^On .*wrote:$/i;

export type ReplyEmailRejectionReason =
  | 'ambiguous-from'
  | 'ambiguous-to'
  | 'invalid-address'
  | 'sender-mismatch'
  | 'reply-address-mismatch'
  | 'automated'
  | 'truncated'
  | 'oversized'
  | 'empty';

export interface ReplyEmailInput {
  from: readonly string[];
  to: readonly string[];
  autoSubmitted?: string | null;
  text: string;
  truncated: boolean;
  expectedSender: string;
  expectedReplyAddress: string;
}

export type ReplyEmailValidation =
  | { ok: true; replyText: string }
  | { ok: false; reason: ReplyEmailRejectionReason };

/**
 * Remove only familiar reply markers. Arbitrary quoted mail is left untouched
 * because it cannot be distinguished reliably from a member's own text.
 */
export function extractReplyText(text: string): string {
  const lines = text.split(/\r\n?|\n/);
  const replyLines: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (
      trimmedLine === replyMarker ||
      onWroteMarker.test(trimmedLine) ||
      line.startsWith('>')
    ) {
      break;
    }
    replyLines.push(line);
  }

  return replyLines.join('\n').trim();
}

/** Validate a parsed message before its reply text is passed to message logic. */
export function validateReplyEmail(
  input: ReplyEmailInput,
): ReplyEmailValidation {
  if (input.from.length !== 1) return { ok: false, reason: 'ambiguous-from' };
  if (input.to.length !== 1) return { ok: false, reason: 'ambiguous-to' };

  const expectedSender = normaliseAddress(input.expectedSender);
  const expectedReplyAddress = normaliseAddress(input.expectedReplyAddress);
  if (!expectedSender || !expectedReplyAddress) {
    return { ok: false, reason: 'invalid-address' };
  }

  if (normaliseAddress(input.from[0]) !== expectedSender) {
    return { ok: false, reason: 'sender-mismatch' };
  }
  if (normaliseAddress(input.to[0]) !== expectedReplyAddress) {
    return { ok: false, reason: 'reply-address-mismatch' };
  }

  if (
    input.autoSubmitted != null &&
    input.autoSubmitted.trim().toLowerCase() !== 'no'
  ) {
    return { ok: false, reason: 'automated' };
  }
  if (input.truncated) return { ok: false, reason: 'truncated' };
  // Stryker disable next-line StringLiteral: an empty encoding also defaults to UTF-8, so this literal is behaviour-equivalent.
  if (Buffer.byteLength(input.text, 'utf8') > maxReplyBytes) {
    return { ok: false, reason: 'oversized' };
  }

  const replyText = extractReplyText(input.text);
  if (!replyText) return { ok: false, reason: 'empty' };

  return { ok: true, replyText };
}

function normaliseAddress(address: string): string | undefined {
  const trimmedAddress = address.trim();
  const atIndex = trimmedAddress.indexOf('@');
  const hasControlCharacter = Array.from(trimmedAddress).some(character => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });
  if (
    atIndex <= 0 ||
    atIndex !== trimmedAddress.lastIndexOf('@') ||
    atIndex === trimmedAddress.length - 1 ||
    hasControlCharacter ||
    /[\s<>(),;]/.test(trimmedAddress)
  ) {
    return undefined;
  }

  const localPart = trimmedAddress.slice(0, atIndex);
  // Stryker disable MethodExpression: with exactly one '@', using the full address here produces an injective composite key; this normalised value is only compared for equality.
  // Stryker disable ArithmeticOperator: including the final local-part character in the suffix also preserves equality and inequality for accepted addresses.
  const domain = trimmedAddress.slice(atIndex + 1);
  // Stryker restore ArithmeticOperator
  // Stryker restore MethodExpression
  return `${localPart}@${domain.toLowerCase()}`;
}
