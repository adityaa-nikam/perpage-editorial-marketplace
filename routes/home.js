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
      featuredWriters = await User.find({
        role: 'writer',
        pricePerPage: { $gt: 0 },
        bio: { $exists: true, $ne: '' }
      })
        .sort({ createdAt: -1 })
        .limit(3)
        .select('name bio pricePerPage profilePic _id')
        .lean();

      if (!featuredWriters || featuredWriters.length === 0) {
        featuredWriters = await User.find({ role: 'writer' })
          .sort({ createdAt: -1 })
          .limit(3)
          .select('name bio pricePerPage profilePic _id')
          .lean();
      }
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
    } else if (req.query.mockWriters === '1' || (featuredWriters.length === 0 && req.query.empty !== '1')) {
      featuredWriters = [
        {
          _id: '64f1a2b3c4d5e6f7a8b9c0d1',
          name: 'Ananya Sharma',
          bio: 'Edits reports, essays and cover letters for clarity and structure.',
          pricePerPage: 45,
          profilePic: ''
        },
        {
          _id: '64f1a2b3c4d5e6f7a8b9c0d2',
          name: 'Rohan Verma',
          bio: 'Reviews draft flow, sentence structure and document readability.',
          pricePerPage: 35,
          profilePic: ''
        },
        {
          _id: '64f1a2b3c4d5e6f7a8b9c0d3',
          name: 'Priya Nair',
          bio: 'Provides line editing and detailed feedback on personal drafts.',
          pricePerPage: 50,
          profilePic: ''
        }
      ];
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
