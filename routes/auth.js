import express from 'express';
import passport from 'passport';
import bcrypt from 'bcrypt';
import { body, validationResult } from 'express-validator';
import { User } from '../models/User.js';

const router = express.Router();

// Register Page
router.get('/register', (req, res) => {
  res.render('register');
});

// Register Logic
router.post('/register',
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
  res.render('login-improved');
});

// Login Logic with error handling
router.post('/login', (req, res, next) => {
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
    
    req.logIn(user, (err) => {
      if (err) {
        console.error('❌ Login session error:', err.message);
        return res.status(500).send('Login session failed. Please try again.');
      }
      return res.redirect('/home');
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
    
    req.logIn(user, (err) => {
      if (err) {
        console.error('❌ Google OAuth login session error:', err.message);
        return res.redirect('/login?error=session_failed');
      }
      return res.redirect('/home');
    });
  })(req, res, next);
});


//git auth with error handling
router.get('/auth/github', passport.authenticate('github', { scope: ['profile','email'] }));
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
    
    req.logIn(user, (err) => {
      if (err) {
        console.error('❌ GitHub OAuth login session error:', err.message);
        return res.redirect('/login?error=session_failed');
      }
      return res.redirect('/home');
    });
  })(req, res, next);
});

// Logout with error handling
router.get('/logout', (req, res, next) => {
  req.logout(function (err) {
    if (err) {
      console.error('❌ Logout error:', err.message);
      return next(err);
    }
    console.log('✅ User logged out successfully');
    res.redirect('/login');
  });
});

export default router;
