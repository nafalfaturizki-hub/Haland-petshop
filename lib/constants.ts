// J1: Centralized constants — no magic numbers in business logic.
// Import these values instead of hard-coding literals.

export const RATE_LIMIT = {
  WINDOW_MS: 15 * 60 * 1000,
  MAX_ATTEMPTS: 5,
  LOCKOUT_DURATION_MS: 15 * 60 * 1000,
} as const;

export const SSE = {
  HEARTBEAT_INTERVAL_MS: 60000,
} as const;

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 200,
} as const;

export const SANITIZE = {
  MAX_TEXT_LENGTH: 2000,
  MAX_NAME_LENGTH: 100,
  MAX_NOTES_LENGTH: 1000,
} as const;

export const FILE = {
  MAX_ATTACHMENT_SIZE_BYTES: 5 * 1024 * 1024,
  ALLOWED_ATTACHMENT_TYPES: [
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ] as readonly string[],
} as const;

export const RETRY = {
  INVOICE_NUMBER_MAX_ATTEMPTS: 3,
} as const;
