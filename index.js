import dns from 'node:dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path, { isAbsolute } from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import passport from 'passport';
import methodOverride from 'method-override';
import helmet from 'helmet';

import initialize from './config/passport-config.js';
import connectDB from './config/db.js';
import { checkDatabaseHealth, startDatabaseMonitor } from './utils/dbHealthCheck.js';
import { icon } from './utils/icons.js';
import { SITE_URL, REPO_URL, vocab } from './config/site.js';
import { generalLimiter } from './config/limits.js';
import csrfOrigin from './middleware/csrfOrigin.js';
import { User } from './models/User.js';

// Route imports
import profile from './routes/profile.js';
import about from './routes/about.js';
import authRoutes from './routes/auth.js';
import homeRoutes from './routes/home.js';
import dealRoutes from './routes/deal.js';
import dashboardRoutes from './routes/dashboard.js';
import writerRoutes from './routes/writers.js';
import paymentRoutes from './routes/payment.js';
import notificationsRoutes from './routes/notifications.js';

dotenv.config();

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Promise Rejection:', reason);
  console.error('Promise:', promise);
  console.warn('⚠️ Application will continue running, but this should be investigated');
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
  console.error(error.stack);
  console.error('💀 Application will exit');
  process.exit(1);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Validate essential environment variables & startup summary
const requiredEnvVars = ['MONGO_URL'];
const missingRequired = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingRequired.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingRequired.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.error('Please check your .env file and ensure all required variables are set.');
  process.exit(1);
}

// Support AWS_BUCKET_NAME alias
if (!process.env.S3_BUCKET_NAME && process.env.AWS_BUCKET_NAME) {
  process.env.S3_BUCKET_NAME = process.env.AWS_BUCKET_NAME;
}

// One-time startup summary for expected/optional variables (names only, never values)
const expectedEnvVars = [
  'MONGO_URL',
  'SESSION_SECRET',
  'SITE_URL',
  'REPO_URL',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'S3_BUCKET_NAME',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET'
];
const missingExpected = expectedEnvVars.filter(varName => !process.env[varName]);
if (missingExpected.length > 0) {
  console.warn('⚠️ [Startup Check] The following expected/optional environment variables are unset:');
  missingExpected.forEach(varName => console.warn(`   - ${varName}`));
}

console.log('✅ Environment variables validated');

const app = express();
const port = process.env.PORT || 3000;

// Trust reverse proxy (e.g. Render, AWS ALB) for secure cookies and client IP rate-limiting
app.set('trust proxy', 1);

// Body parsers with sensible size limits
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(express.json({ limit: '100kb' }));

// Method override for forms using ?_method=
app.use(methodOverride('_method'));

// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session configuration
const sessionSecret = process.env.SESSION_SECRET || 'secretkey';
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  console.warn('⚠️ WARNING: SESSION_SECRET is not set in production. Using insecure default secret fallback!');
}

const sessionStore = MongoStore.create({
  mongoUrl: process.env.MONGO_URL,
  collectionName: 'sessions',
  touchAfter: 24 * 3600, // lazy session update
  ttl: 14 * 24 * 60 * 60, // 14 days
  autoRemove: 'native'
});

// Suppress unhandled promise rejections when database connection times out or is unreachable
if (sessionStore.clientP && typeof sessionStore.clientP.catch === 'function') {
  sessionStore.clientP.catch((err) => {
    console.warn('⚠️ Session store could not reach MongoDB Atlas (offline or IP not whitelisted):', err.message);
  });
}
if (sessionStore.collectionP && typeof sessionStore.collectionP.catch === 'function') {
  sessionStore.collectionP.catch(() => {
    // collectionP rejection is tied to clientP rejection
  });
}

sessionStore.on('error', (error) => {
  console.error('❌ Session store error:', error.message);
  console.warn('⚠️ Sessions may not persist properly without database connection');
});

app.use(session({
  name: 'connect.sid',
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  }
}));

// Passport Initialization
try {
  initialize(passport);
  app.use(passport.initialize());
  app.use(passport.session());
  console.log('✅ Passport initialized successfully');
} catch (error) {
  console.error('❌ Passport initialization failed:', error.message);
  console.warn('⚠️ Authentication features may not work properly');
}

// Generate per-request CSP nonce
app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
});

// Helmet Security Headers with CSP in REPORT-ONLY mode
app.use((req, res, next) => {
  helmet({
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin'
    },
    contentSecurityPolicy: {
      reportOnly: true,
      directives: {
        defaultSrc: ["'self'"],
        // 'unsafe-eval' is required by standard Alpine.js build to evaluate reactive x-data / x-on directives
        scriptSrc: [
          "'self'",
          `'nonce-${res.locals.cspNonce}'`,
          "https://cdn.jsdelivr.net",
          "https://checkout.razorpay.com",
          "'unsafe-eval'"
        ],
        styleSrc: ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://lumberjack.razorpay.com", "https://api.razorpay.com"],
        frameSrc: ["'self'", "https://api.razorpay.com"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"]
      }
    }
  })(req, res, next);
});

// Provide Razorpay Key ID to all rendered views
app.use((req, res, next) => {
  res.locals.razorpayKeyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_TmcIAG1CGAmuwk';
  next();
});

// Compute content hash of public/css/app.css for asset versioning & cache-busting
let assetVersion = '1';
try {
  const cssPath = path.join(__dirname, 'public', 'css', 'app.css');
  if (fs.existsSync(cssPath)) {
    const cssContent = fs.readFileSync(cssPath);
    assetVersion = crypto.createHash('md5').update(cssContent).digest('hex').slice(0, 8);
  }
} catch (err) {
  console.warn('⚠️ Could not compute CSS asset hash:', err.message);
}

// Static Files with caching headers (7 days for versioned static assets)
app.use('/css', express.static(path.join(__dirname, 'public', 'css'), { maxAge: '7d' }));
app.use('/fonts', express.static(path.join(__dirname, 'public', 'fonts'), { maxAge: '7d' }));
app.use('/img', express.static(path.join(__dirname, 'public', 'img'), { maxAge: '7d' }));
app.use(express.static(path.join(__dirname, 'public')));

// View Helpers & Global State
app.locals.icon = icon;
app.locals.vocab = vocab;

app.use((req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.vocab = vocab;
  if (process.env.NODE_ENV !== 'production' && req.query.mockUser === '1') {
    res.locals.user = {
      _id: '64f1a2b3c4d5e6f7a8b9c0d9',
      name: 'Eleanor Vance',
      email: 'eleanor@oxford.ac.uk',
      initials: 'EV',
      profilePic: 'https://lh3.googleusercontent.com/a/ACg8ocLo_m7AAlsDq_MSlkUGrc-2UwUCi3fJPTyQIVcVZj1GqSoKLA=s96-c'
    };
  }
  res.locals.currentPath = req.path || '/';
  res.locals.assetVersion = assetVersion;
  res.locals.siteUrl = SITE_URL;
  res.locals.messages = {
    error: req.query.error || null,
    success: req.query.success || null,
    info: req.query.info || null
  };
  next();
});

// Origin/Referer CSRF middleware for state-changing HTTP methods
app.use(csrfOrigin);

if (process.env.NODE_ENV !== 'production') {

  app.get('/mock-download/:key', (req, res) => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="document.pdf"');
    res.send(Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n'));
  });

  app.get('/test-error/:code', (req, res, next) => {
    const code = parseInt(req.params.code, 10) || 500;
    const err = new Error(`Simulated ${code} error`);
    err.statusCode = code;
    next(err);
  });
}

// SEO: robots.txt
app.get('/robots.txt', (req, res) => {
  const baseUrl = SITE_URL || `${req.protocol}://${req.get('host')}`;
  res.type('text/plain');
  res.send(`User-agent: *\nAllow: /\n\nSitemap: ${baseUrl}/sitemap.xml\n`);
});

// SEO: sitemap.xml
app.get('/sitemap.xml', async (req, res) => {
  try {
    const baseUrl = SITE_URL || `${req.protocol}://${req.get('host')}`;
    let writersWithBio = [];
    if (mongoose.connection.readyState === 1) {
      writersWithBio = await User.find({
        role: 'writer',
        bio: { $exists: true, $ne: '' }
      }).select('_id updatedAt').limit(1000).lean();
    }

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    const staticPages = ['', '/writers', '/about', '/acceptable-use'];
    staticPages.forEach(p => {
      xml += `  <url>\n    <loc>${baseUrl}${p}</loc>\n    <changefreq>daily</changefreq>\n  </url>\n`;
    });
    writersWithBio.forEach(w => {
      xml += `  <url>\n    <loc>${baseUrl}/writers/${w._id}</loc>\n    <changefreq>weekly</changefreq>\n  </url>\n`;
    });
    xml += '</urlset>';

    res.type('application/xml');
    res.send(xml);
  } catch (err) {
    console.error('Sitemap generation error:', err.message);
    res.status(500).end();
  }
});

// General rate limiter on application routes
app.use(generalLimiter);

// Acceptable Use Policy Route (Guardrail A)
app.get('/acceptable-use', (req, res) => {
  const baseUrl = SITE_URL || `${req.protocol}://${req.get('host')}`;
  res.render('acceptableUse', {
    pageTitle: 'Acceptable Use Policy — PerPage',
    metaDescription: 'Acceptable use guidelines for PerPage: document editing, feedback, permitted scope, client responsibilities, and academic demonstration terms.',
    canonical: `${baseUrl}/acceptable-use`
  });
});

// Route Mounting
app.use('/', authRoutes);                // /login, /register, /auth/google, etc.
app.use('/home', homeRoutes);            // /home (protected)
app.use('/deal', dealRoutes);            // /deal (uploads, forms)
app.use('/dashboard', dashboardRoutes);  // /dashboard view
app.use('/writers', writerRoutes);        // /writers (writer-specific routes)
app.use('/profile', profile);             // /profile/:id (writer profile)
app.use('/about', about);                 // /about
app.use('/payment', paymentRoutes);       // /payment (Razorpay checkout & verify)
app.use('/api/notifications', notificationsRoutes); // /api/notifications (in-app notifications)

// Default Route - Directly renders home page
app.use('/', homeRoutes);

// Test API endpoint
app.get('/api/test', (req, res) => {
  try {
    res.status(200).json({
      message: 'Hello from Express!',
      status: 'Server is running',
      timestamp: new Date().toISOString(),
      database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
    });
  } catch (error) {
    console.error('❌ Test API error:', error.message);
    res.status(500).json({ error: 'Test API failed' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  try {
    const dbHealth = checkDatabaseHealth();
    const health = {
      status: dbHealth.isHealthy ? 'OK' : 'DEGRADED',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      database: dbHealth,
      memory: process.memoryUsage(),
      version: process.version
    };

    const statusCode = dbHealth.isHealthy ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    console.error('❌ Health check error:', error.message);
    res.status(500).json({
      status: 'ERROR',
      message: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

// 404 Catch-All as LAST route
app.use((req, res) => {
  res.status(404);
  if (req.accepts('html')) {
    return res.render('error', {
      statusCode: 404,
      heading: 'Page not found',
      explanation: 'The page you requested could not be found or has moved.',
      retryUrl: req.originalUrl
    });
  }
  res.json({ error: 'Page not found', statusCode: 404 });
});

// Global Error Handler as LAST middleware
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  // Log error: message and stack only (never request bodies, cookies, or tokens)
  console.error(`❌ [${req.method} ${req.path}] Error:`, err.message);
  if (err.stack) {
    console.error(err.stack);
  }

  let statusCode = 500;
  let heading = 'Something went wrong';
  let explanation = 'An unexpected server error occurred. Please try again.';

  if (err.name === 'CastError') {
    statusCode = 404;
    heading = 'Item not found';
    explanation = 'The requested item or resource could not be found.';
  } else if (err.name === 'ValidationError') {
    statusCode = 422;
    heading = 'Validation error';
    explanation = process.env.NODE_ENV === 'production'
      ? 'The submitted data failed validation requirements.'
      : (err.message || 'Validation error');
  } else if (err.statusCode && typeof err.statusCode === 'number') {
    statusCode = err.statusCode;
    heading = statusCode === 404 ? 'Not found' : statusCode === 403 ? 'Access forbidden' : statusCode === 429 ? 'Too many requests' : 'Error';
    explanation = process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'An unexpected error occurred. Please try again shortly.'
      : (err.message || 'An error occurred while processing your request.');
  } else if (err.code === 'EBADCSRFTOKEN' || err.message === 'EBADCSRF' || err.isCsrf) {
    statusCode = 403;
    heading = 'Forbidden';
    explanation = 'Cross-origin request rejected.';
  } else if (err.status === 429 || err.statusCode === 429) {
    statusCode = 429;
    heading = 'Too many requests';
    explanation = 'Too many requests were sent in a short period. Please wait and try again.';
  }

  if (statusCode === 500 && process.env.NODE_ENV === 'production') {
    heading = 'Something went wrong';
    explanation = 'An unexpected error occurred. Please try again shortly.';
  } else if (process.env.NODE_ENV !== 'production' && err.message) {
    explanation = err.message;
  }

  res.status(statusCode);
  if (req.accepts('html')) {
    return res.render('error', {
      statusCode,
      heading,
      explanation,
      retryUrl: req.originalUrl
    });
  }
  res.json({
    statusCode,
    error: heading,
    message: explanation
  });
});

// Start Server
const startServer = async () => {
  try {
    console.log('🚀 Starting server...');

    // Try to connect to database
    try {
      await connectDB();
      console.log('✅ Database connection successful');

      // Start database monitoring after successful initial connection
      startDatabaseMonitor();
    } catch (dbError) {
      console.error('❌ Database connection failed:', dbError.message);
      console.warn('⚠️ Server will start without database connection');
      console.warn('⚠️ Some features requiring database may not work');
    }

    // Start server with automatic retry on port collision
    let retryCount = 0;
    const maxRetries = 3;

    const startListening = () => {
      const server = app.listen(port, () => {
        console.log(`🚀 Server running at http://localhost:${port}`);
        console.log('✅ Server started successfully');
      });

      server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          if (retryCount < maxRetries) {
            retryCount++;
            console.warn(`⚠️ Port ${port} is temporarily busy. Retrying in 1s (${retryCount}/${maxRetries})...`);
            setTimeout(() => {
              try { server.close(); } catch (e) {}
              startListening();
            }, 1000);
            return;
          }
          console.error(`❌ Port ${port} is already in use.`);
          console.error(`To free port ${port} on Windows, run in PowerShell:`);
          console.error(`   Stop-Process -Id (Get-NetTCPConnection -LocalPort ${port}).OwningProcess -Force`);
        } else {
          console.error('❌ Server error:', error.message);
        }
        process.exit(1);
      });

      // Graceful shutdown
      const shutdown = async (signal) => {
        console.log(`🛑 ${signal} received, shutting down gracefully`);
        try {
          await new Promise((resolve) => server.close(resolve));
          console.log('✅ Server closed');
          await mongoose.connection.close();
          console.log('✅ Database connection closed');
          process.exit(0);
        } catch (closeErr) {
          console.error('❌ Error during shutdown:', closeErr);
          process.exit(1);
        }
      };

      process.once('SIGTERM', () => shutdown('SIGTERM'));
      process.once('SIGINT', () => shutdown('SIGINT'));
    };

    startListening();

  } catch (err) {
    console.error('❌ Server failed to start:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
};

// Launch application server on port 3000
startServer();
