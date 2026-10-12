import express from 'express';
import mongoose from 'mongoose';
import passport from 'passport';
import { User } from '../models/User.js';

const router = express.Router();

const renderHome = async (req, res) => {
  let featuredWriters = [];
  const isDbConnected = mongoose.connection.readyState === 1;

  if (isDbConnected) {
    try {
      // Fetch only real registered writers from MongoDB, prioritizing those with ratings and rates
      featuredWriters = await User.find({
        role: 'writer'
      })
        .sort({ averageRating: -1, reviewCount: -1, createdAt: -1 })
        .limit(3)
        .select('name bio pricePerPage profilePic averageRating reviewCount createdAt _id')
        .lean();
    } catch (err) {
      console.warn('⚠️ Could not fetch featured writers (DB error):', err.message);
      featuredWriters = [];
    }
  }

  // Development environment previews for acceptance testing
  let currentUser = req.user;
  if (process.env.NODE_ENV !== 'production') {
    if (req.query.mockUser === '1') {
      currentUser = {
        _id: 'mock-user-123',
        name: 'Alex Rivera',
        role: 'student',
        email: 'alex@example.edu',
        profilePic: 'https://lh3.googleusercontent.com/a/ACg8ocLo_m7AAlsDq_MSlkUGrc-2UwUCi3fJPTyQIVcVZj1GqSoKLA=s96-c'
      };
    }
    if (req.query.empty === '1') {
      featuredWriters = [];
    }
  }

  res.render('home', {
    user: currentUser,
    featuredWriters
  });
};

const handleHomeRoute = (req, res, next) => {
  // If an OAuth authorization code lands on the root home route (e.g. GOOGLE_CALLBACK_URL=http://localhost:3000)
  if (req.query.code && (!req.isAuthenticated || !req.isAuthenticated())) {
    return passport.authenticate('google', (err, user, info) => {
      if (err) {
        console.error('❌ Google OAuth callback error at root:', err.message);
        return res.redirect('/login?error=oauth_failed');
      }
      if (!user) {
        console.warn('⚠️ Google OAuth callback at root: No user returned');
        return res.redirect('/login?error=oauth_failed');
      }
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.error('❌ Login error at root:', loginErr.message);
          return res.redirect('/login?error=session_failed');
        }
        if (req.session && typeof req.session.save === 'function') {
          return req.session.save((saveErr) => {
            if (saveErr) console.error('❌ Session save error:', saveErr.message);
            return res.redirect('/');
          });
        }
        return res.redirect('/');
      });
    })(req, res, next);
  }
  return renderHome(req, res);
};

router.get('/', handleHomeRoute);
router.get('/home', handleHomeRoute);

export default router;
