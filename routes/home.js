import express from 'express';
import { User } from '../models/User.js';

const router = express.Router();

const renderHome = async (req, res) => {
  let featuredWriters = [];
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
    console.warn('⚠️ Could not fetch featured writers (DB offline or error):', err.message);
    featuredWriters = [];
  }

  // Development environment previews for acceptance testing
  let currentUser = req.user;
  if (process.env.NODE_ENV !== 'production') {
    if (req.query.mockUser === '1') {
      currentUser = {
        _id: 'mock-user-123',
        name: 'Alex Rivera',
        role: 'student',
        email: 'alex@example.edu'
      };
    }
    if (req.query.empty === '1') {
      featuredWriters = [];
    } else if (req.query.mockWriters === '1' || (featuredWriters.length === 0 && req.query.empty !== '1')) {
      featuredWriters = [
        {
          _id: '64f1a2b3c4d5e6f7a8b9c0d1',
          name: 'Dr. Eleanor Vance',
          bio: 'Specializing in behavioral economics, public policy analysis, and empirical research frameworks.',
          pricePerPage: 150,
          profilePic: ''
        },
        {
          _id: '64f1a2b3c4d5e6f7a8b9c0d2',
          name: 'Prof. Liam Davies',
          bio: 'Academic author with extensive background in comparative literature, archival research, and qualitative critique.',
          pricePerPage: 120,
          profilePic: ''
        },
        {
          _id: '64f1a2b3c4d5e6f7a8b9c0d3',
          name: 'Sophia Chen',
          bio: 'Biotechnology graduate researcher focusing on clinical trial syntheses, molecular biology, and APA formatting.',
          pricePerPage: 180,
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

router.get('/', renderHome);
router.get('/home', renderHome);

export default router;
