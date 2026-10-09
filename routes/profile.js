import express from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import Deal from '../models/deal.js';

const router = express.Router();

// Middleware to check if user is logged in
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  if (process.env.NODE_ENV !== 'production' && req.query.mockUser) {
    req.user = {
      _id: req.params.id,
      name: 'Dr. Eleanor Vance',
      email: 'eleanor@oxford.ac.uk',
      role: 'writer',
      bio: 'Specializing in behavioral economics, public policy analysis, and empirical research frameworks.',
      pricePerPage: 150,
      address: 'Oxford, United Kingdom',
      createdAt: new Date('2023-04-15')
    };
    return next();
  }
  res.redirect('/login');
}

// GET /profile/:id - Signed-in user's own profile view / edit page
router.get('/:id', isAuthenticated, async (req, res) => {
  const { id } = req.params;

  // Allow only the logged-in user to view their own profile
  if (req.user._id.toString() !== id) {
    return res.status(403).send('Access denied. You can only view your own profile.');
  }

  try {
    let user = null;
    let completedCount = 0;

    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected && mongoose.Types.ObjectId.isValid(id)) {
      user = await User.findById(id).lean();
      if (user && user.role === 'writer') {
        completedCount = await Deal.countDocuments({
          writerId: user._id,
          status: 'completed'
        });
      }
    }

    // Dev mock fallback for testing when DB is disconnected
    if (!user && process.env.NODE_ENV !== 'production') {
      user = {
        _id: req.user._id,
        name: req.user.name || 'Dr. Eleanor Vance',
        email: req.user.email || 'eleanor@oxford.ac.uk',
        role: req.user.role || 'writer',
        bio: req.user.bio || 'Specializing in behavioral economics, public policy analysis, and empirical research frameworks.',
        pricePerPage: typeof req.user.pricePerPage === 'number' ? req.user.pricePerPage : 150,
        address: req.user.address || 'Oxford, United Kingdom',
        profilePic: req.user.profilePic || '',
        createdAt: req.user.createdAt || new Date('2023-04-15')
      };
      completedCount = 14;
    }

    if (!user) {
      return res.status(404).send('User not found');
    }

    res.render('profile', {
      userProfile: user,
      writer: user, // Alias for backward compatibility
      completedCount,
      user: req.user,
      success: req.query.success || null,
      pageTitle: `My Profile (${user.name}) — PerPage`,
      noindex: true // Never index private account profile settings
    });
  } catch (error) {
    console.error('❌ Profile route error:', error.message);
    res.status(500).send('Server Error');
  }
});

// POST /profile/:id/edit - Edit profile action
router.post('/:id/edit', isAuthenticated, async (req, res) => {
  const { id } = req.params;

  // Allow only the logged-in user to edit their own profile
  if (req.user._id.toString() !== id) {
    return res.status(403).send('Unauthorized');
  }

  try {
    const { name, bio, pricePerPage, role, address } = req.body;

    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected && mongoose.Types.ObjectId.isValid(id)) {
      const updateData = {
        name: typeof name === 'string' ? name.trim() : undefined,
        bio: typeof bio === 'string' ? bio.trim() : undefined,
        pricePerPage: Number(pricePerPage) >= 0 ? Number(pricePerPage) : 0,
        role: ['user', 'writer'].includes(role) ? role : 'user'
      };
      if (typeof address === 'string') {
        updateData.address = address.trim();
      }

      await User.findByIdAndUpdate(id, updateData);
    }

    res.redirect(`/profile/${id}?success=Profile+updated+successfully`);
  } catch (error) {
    console.error('❌ Profile update error:', error.message);
    res.status(500).send('Error updating profile');
  }
});

export default router;
