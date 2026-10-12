/**
 * Strict validator for return-to / redirection targets to prevent open redirects.
 * Validates that redirect paths are strictly local, relative paths.
 * 
 * Rules:
 * - Must be a string
 * - Length between 1 and 300 characters
 * - Must start with a single '/'
 * - Must NOT start with '//' or '/\'
 * - Must contain no backslashes
 * - Must contain no control characters (\x00-\x1F, \x7F)
 * - Must not contain URI schemes (e.g. javascript:, https:, etc.)
 * 
 * @param {string} url - Target URL candidate
 * @param {string} fallback - Fallback URL if validation fails (default '/dashboard')
 * @returns {string} Validated local path or fallback
 */
export function getSafeRedirect(url, fallback = '/dashboard') {
  if (typeof url !== 'string') {
    return fallback;
  }

  const target = url.trim();

  if (target.length === 0 || target.length > 300) {
    return fallback;
  }

  // Must start with single slash, not protocol-relative // or /\
  if (!target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) {
    return fallback;
  }

  // Must contain no backslashes
  if (target.includes('\\')) {
    return fallback;
  }

  // Must contain no control characters
  if (/[\x00-\x1F\x7F]/.test(target)) {
    return fallback;
  }

  // Reject URL scheme indicators before any path resolution
  if (/^\/[a-zA-Z][a-zA-Z0-9+.-]*:/.test(target)) {
    return fallback;
  }

  return target;
}

export default getSafeRedirect;
