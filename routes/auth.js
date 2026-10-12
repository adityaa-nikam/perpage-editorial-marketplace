import express from 'express';
import passport from 'passport';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { User } from '../models/User.js';
import { loginLimiter, registerLimiter } from '../config/limits.js';
import { getSafeRedirect } from '../utils/safeRedirect.js';

const router = express.Router();

// Register Page
router.get('/register', (req, res) => {
  res.render('register');
});

// Register Logic with Rate Limiting
router.post('/register',
  registerLimiter,
  [
    body('email').isEmail().withMessage('Enter a valid email'),
    body('password').isLength({ min: 8, max: 72 }).withMessage('Password must be between 8 and 72 characters'),
    body('name').notEmpty().withMessage('Name is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).send(errors.array().map(err => err.msg).join('<br>'));
      }

      const { name, email, password } = req.body;
      const role = req.body.role === 'writer' ? 'writer' : 'user'; // Whitelist role: never admin
      const bio = typeof req.body.bio === 'string' ? req.body.bio.trim().slice(0, 1000) : '';
      const address = typeof req.body.address === 'string' ? req.body.address.trim().slice(0, 200) : '';

      // Check if user exists
      const exists = await User.findOne({ email });
      if (exists) {
        return res.status(400).send('User already exists!');
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = new User({ name, email, password: hashedPassword, role, bio, address });
      await newUser.save();

      res.redirect('/login');
    } catch (error) {
      console.error('❌ Registration error:', error.message);
      
      if (error.name === 'MongoNetworkError' || error.name === 'MongooseServerSelectionError') {
        return res.status(503).send('Database connection error. Please check your internet connection and try again.');
      }
      
      if (error.name === 'ValidationError') {
        return res.status(400).send('Invalid user data provided.');
      }
      
      res.status(500).send('Registration failed. Please try again.');
    }
  }
);

// Login Page
router.get('/login', (req, res) => {
  res.render('login');
});

// Helper for safe post-login redirection
function redirectAfterLogin(req, res) {
  const returnTo = req.session?.returnTo;
  if (req.session) {
    delete req.session.returnTo;
  }
  const target = getSafeRedirect(returnTo, '/dashboard');
  if (req.session && typeof req.session.save === 'function') {
    return req.session.save((saveErr) => {
      if (saveErr) console.error('❌ Session save error:', saveErr.message);
      return res.redirect(target);
    });
  }
  return res.redirect(target);
}

// Login Logic with failure-only rate limiting
router.post('/login', loginLimiter, (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      console.error('❌ Login authentication error:', err.message);
      if (err.name === 'MongoNetworkError' || err.name === 'MongooseServerSelectionError') {
        return res.status(503).send('Database connection error. Please check your internet connection and try again.');
      }
      return res.status(500).send('Authentication failed. Please try again.');
    }
    
    if (!user) {
      return res.status(401).send(info.message || 'Login failed');
    }
    
    req.logIn(user, (loginErr) => {
      if (loginErr) {
        console.error('❌ Login session error:', loginErr.message);
        return res.status(500).send('Login session failed. Please try again.');
      }
      return redirectAfterLogin(req, res);
    });
  })(req, res, next);
});

// Google OAuth with error handling
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/auth/google/callback', (req, res, next) => {
  passport.authenticate('google', (err, user, info) => {
    if (err) {
      console.error('❌ Google OAuth error:', err.message);
      return res.redirect('/login?error=oauth_failed');
    }
    
    if (!user) {
      console.warn('⚠️ Google OAuth failed - no user returned');
      return res.redirect('/login?error=oauth_failed');
    }
    
    req.logIn(user, (loginErr) => {
      if (loginErr) {
        console.error('❌ Google OAuth login session error:', loginErr.message);
        return res.redirect('/login?error=session_failed');
      }
      return redirectAfterLogin(req, res);
    });
  })(req, res, next);
});

// GitHub OAuth with error handling
router.get('/auth/github', passport.authenticate('github', { scope: ['profile', 'email'] }));
router.get('/auth/github/callback', (req, res, next) => {
  passport.authenticate('github', (err, user, info) => {
    if (err) {
      console.error('❌ GitHub OAuth error:', err.message);
      return res.redirect('/login?error=oauth_failed');
    }
    
    if (!user) {
      console.warn('⚠️ GitHub OAuth failed - no user returned');
      return res.redirect('/login?error=oauth_failed');
    }
    
    req.logIn(user, (loginErr) => {
      if (loginErr) {
        console.error('❌ GitHub OAuth login session error:', loginErr.message);
        return res.redirect('/login?error=session_failed');
      }
      return redirectAfterLogin(req, res);
    });
  })(req, res, next);
});

// Logout via POST: ends session and redirects to /
router.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) {
      console.error('❌ Logout error:', err.message);
      return next(err);
    }
    if (req.session) {
      req.session.destroy((destroyErr) => {
        if (destroyErr) {
          console.warn('⚠️ Session destroy error on logout:', destroyErr.message);
        }
        res.clearCookie('connect.sid');
        console.log('✅ User logged out and session destroyed');
        return res.redirect('/');
      });
    } else {
      res.clearCookie('connect.sid');
      return res.redirect('/');
    }
  });
});

// GET /logout no longer logs anyone out; it redirects to /
router.get('/logout', (req, res) => {
  res.redirect('/');
});

export default router;
