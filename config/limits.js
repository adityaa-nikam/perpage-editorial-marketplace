import rateLimit from 'express-rate-limit';

// Named limit constants
export const AUTH_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const AUTH_MAX = 10; // 10 attempts per 15 minutes

export const DEAL_WINDOW_MS = 60 * 60 * 1000; // 1 hour
export const DEAL_MAX = 20; // 20 requests per hour

export const GENERAL_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const GENERAL_MAX = 300; // 300 requests per 15 minutes

const isBypassed = () => {
  return process.env.NODE_ENV !== 'production' && process.env.RATE_LIMIT_DISABLED === '1';
};

const render429Handler = (req, res, next, options) => {
  const retryAfterSec = Math.ceil((options.windowMs || 60000) / 1000);
  res.setHeader('Retry-After', String(retryAfterSec));
  res.status(429);

  if (req.accepts('html')) {
    return res.render('error', {
      statusCode: 429,
      heading: 'Too many requests',
      explanation: 'Too many requests were sent in a short period. Please wait and try again.',
      retryUrl: req.originalUrl
    });
  }

  return res.json({
    statusCode: 429,
    error: 'Too many requests',
    message: 'Too many requests from this IP, please try again later.'
  });
};

/**
 * Limiter for POST /login (counting only failures)
 */
export const loginLimiter = rateLimit({
  windowMs: AUTH_WINDOW_MS,
  limit: AUTH_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: isBypassed,
  handler: render429Handler
});

/**
 * Limiter for POST /register
 */
export const registerLimiter = rateLimit({
  windowMs: AUTH_WINDOW_MS,
  limit: AUTH_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isBypassed,
  handler: render429Handler
});

/**
 * Limiter for POST /deal and POST /upload-final
 */
export const dealActionLimiter = rateLimit({
  windowMs: DEAL_WINDOW_MS,
  limit: DEAL_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isBypassed,
  handler: render429Handler
});

/**
 * General application limiter
 */
export const generalLimiter = rateLimit({
  windowMs: GENERAL_WINDOW_MS,
  limit: GENERAL_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isBypassed,
  handler: render429Handler
});

export default {
  AUTH_WINDOW_MS,
  AUTH_MAX,
  DEAL_WINDOW_MS,
  DEAL_MAX,
  GENERAL_WINDOW_MS,
  GENERAL_MAX,
  loginLimiter,
  registerLimiter,
  dealActionLimiter,
  generalLimiter
};
