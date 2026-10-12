import { SITE_URL } from '../config/site.js';

/**
 * Origin/Referer CSRF protection middleware for state-changing HTTP methods.
 * Protects POST, PUT, PATCH, and DELETE without requiring body tokens,
 * allowing multipart forms (multer) and existing frozen endpoints to remain intact.
 */
export function csrfOrigin(req, res, next) {
  const method = req.method.toUpperCase();

  // Safe methods are exempt
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return next();
  }

  const originHeader = req.headers['origin'];
  const refererHeader = req.headers['referer'] || req.headers['referrer'];
  const secFetchSite = req.headers['sec-fetch-site'];

  // Check for explicit "null" origin (e.g. file://, sandboxed iframe)
  if (originHeader === 'null') {
    return rejectCsrf(req, res);
  }

  // If Sec-Fetch-Site header is present and cross-site, reject immediately
  if (secFetchSite === 'cross-site') {
    return rejectCsrf(req, res);
  }

  let sourceHost = null;

  if (originHeader) {
    try {
      sourceHost = new URL(originHeader).host.toLowerCase();
    } catch {
      return rejectCsrf(req, res);
    }
  } else if (refererHeader) {
    try {
      sourceHost = new URL(refererHeader).host.toLowerCase();
    } catch {
      return rejectCsrf(req, res);
    }
  } else {
    // Both Origin and Referer are absent
    // If modern browser verifies same-origin via Sec-Fetch-Site, allow
    if (secFetchSite === 'same-origin' || secFetchSite === 'none') {
      return next();
    }
    // Missing Origin, Referer, and Sec-Fetch-Site on state-changing requests
    return rejectCsrf(req, res);
  }

  const requestHost = (req.get('host') || '').toLowerCase();
  const hostHeader = (req.headers['host'] || '').toLowerCase();
  const forwardedHost = (req.headers['x-forwarded-host'] || '').split(',')[0].trim().toLowerCase();
  let siteUrlHost = null;

  if (SITE_URL) {
    try {
      siteUrlHost = new URL(SITE_URL).host.toLowerCase();
    } catch {
      // Invalid SITE_URL, ignore
    }
  }

  const isLocalHost = (h) => {
    if (!h) return false;
    const clean = h.replace(/:\d+$/, '');
    return clean === 'localhost' || clean === '127.0.0.1' || clean === '::1' || clean === '[::1]';
  };

  const isLocalSource = isLocalHost(sourceHost);
  const isLocalRequest = isLocalHost(requestHost) || isLocalHost(hostHeader) || isLocalHost(forwardedHost);
  const isDevLoopback = process.env.NODE_ENV !== 'production' && isLocalSource && isLocalRequest;

  // Normalized host comparison (ignoring port when base host matches)
  const sourceBase = sourceHost.replace(/:\d+$/, '');
  const requestBase = requestHost.replace(/:\d+$/, '');
  const hostBase = hostHeader.replace(/:\d+$/, '');
  const forwardedBase = forwardedHost.replace(/:\d+$/, '');
  const siteUrlBase = siteUrlHost ? siteUrlHost.replace(/:\d+$/, '') : null;

  const isMatch = (sourceHost === requestHost) ||
                  (sourceHost === hostHeader) ||
                  (forwardedHost && sourceHost === forwardedHost) ||
                  (siteUrlHost && sourceHost === siteUrlHost) ||
                  (sourceBase === requestBase) ||
                  (sourceBase === hostBase) ||
                  (forwardedBase && sourceBase === forwardedBase) ||
                  (siteUrlBase && sourceBase === siteUrlBase) ||
                  isDevLoopback;

  if (!isMatch) {
    return rejectCsrf(req, res);
  }

  next();
}

function rejectCsrf(req, res) {
  res.status(403);
  if (req.accepts('html')) {
    return res.render('error', {
      statusCode: 403,
      heading: 'Forbidden',
      explanation: 'Cross-origin request rejected.',
      retryUrl: req.originalUrl
    });
  }
  return res.json({ error: 'Cross-origin request rejected', statusCode: 403 });
}

export default csrfOrigin;
