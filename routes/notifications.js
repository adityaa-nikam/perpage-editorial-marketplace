import express from 'express';
import mongoose from 'mongoose';
import { getUserNotifications, getUnreadCount, markAsRead, markAllAsRead } from '../utils/notifications.js';

const router = express.Router();

function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  if (process.env.NODE_ENV !== 'production') {
    if (req.headers['x-mock-user']) {
      req.user = {
        _id: new mongoose.Types.ObjectId(req.headers['x-mock-user']),
        name: req.headers['x-mock-name'] || 'QA Mock User'
      };
      return next();
    }
    if (req.query.mockUser === 'writer' || req.query.mockUser === '1') {
      req.user = {
        _id: new mongoose.Types.ObjectId('64f1a2b3c4d5e6f7a8b9c0d1'),
        name: 'Dr. Eleanor Vance',
        role: 'writer'
      };
      return next();
    }
    if (req.query.mockUser === 'student' || req.query.mockUser === '2') {
      req.user = {
        _id: new mongoose.Types.ObjectId('64f1a2b3c4d5e6f7a8b9c0d9'),
        name: 'Aditi Student',
        role: 'user'
      };
      return next();
    }
  }
  return res.status(401).json({ error: 'unauthorized', message: 'You must be signed in.' });
}

// GET /api/notifications
router.get('/', checkAuthenticated, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const notifications = await getUserNotifications(userId, 20);
    const unreadCount = await getUnreadCount(userId);
    return res.json({ success: true, notifications, unreadCount });
  } catch (err) {
    console.error('API get notifications error:', err.message);
    return res.status(500).json({ error: 'server_error', message: 'Failed to retrieve notifications.' });
  }
});

// POST /api/notifications/:id/read
router.post('/:id/read', checkAuthenticated, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { id } = req.params;
    await markAsRead(id, userId);
    const unreadCount = await getUnreadCount(userId);
    return res.json({ success: true, unreadCount });
  } catch (err) {
    console.error('API mark notification read error:', err.message);
    return res.status(500).json({ error: 'server_error', message: 'Failed to update notification.' });
  }
});

// POST /api/notifications/read-all
router.post('/read-all', checkAuthenticated, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    await markAllAsRead(userId);
    return res.json({ success: true, unreadCount: 0 });
  } catch (err) {
    console.error('API mark all read error:', err.message);
    return res.status(500).json({ error: 'server_error', message: 'Failed to mark all notifications read.' });
  }
});

export default router;
