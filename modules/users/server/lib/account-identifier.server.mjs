/**
 * Upper bound for username-or-email identifiers on account lookups.
 * Covers RFC 5321-length emails while remaining far below username limits.
 */
export const ACCOUNT_IDENTIFIER_MAX_LENGTH = 320;
