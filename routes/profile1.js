import express from 'express';
import { User } from '../models/User.js';
import mongoose from 'mongoose';

const router = express.Router();

// Middleware to check if user is logged in
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/login');
}

// GET /profile/:id
router.get('/:id', isAuthenticated, async (req, res) => {
  const { id } = req.params;

  // Allow only the logged-in user to view their own profile
  if (req.user._id.toString() !== id) {
    return res.status(403).send('Access denied');
  }

  try {
    const user = await User.findById(id);
    if (!user) return res.status(404).send('User not found');
    res.render('profile2', { writer: user });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
});

// POST /profile/:id/edit
router.post('/:id/edit', isAuthenticated, async (req, res) => {
  const { id } = req.params;

  // Allow only the logged-in user to edit their own profile
  if (req.user._id.toString() !== id) {
    return res.status(403).send('Unauthorized');
  }

  try {
    const { name, bio, pricePerPage, role } = req.body;

    await User.findByIdAndUpdate(id, {
      name,
      bio,
      pricePerPage,
      role
    });

    res.redirect(`/profile/${id}`);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error updating profile');
  }
});

export default router;
