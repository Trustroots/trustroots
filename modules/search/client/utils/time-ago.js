/**
 * Convert a Unix timestamp (seconds) to a relative time string.
 *
 * @param {number} timestamp
 * @returns {string}
 */
export function timeAgo(timestamp) {
  const seconds = Math.floor(Date.now() / 1000) - timestamp;
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
  if (seconds < 604800) return Math.floor(seconds / 86400) + 'd ago';
  return new Date(timestamp * 1000).toLocaleDateString();
}
