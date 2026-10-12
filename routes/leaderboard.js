import express from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import Deal from '../models/deal.js';

const router = express.Router();

/**
 * Fetch and calculate real-time leaderboard rankings for all editors.
 * Aggregates count of completed deals per writer and orders top to bottom.
 */
export async function getLeaderboardData() {
  const isDbConnected = mongoose.connection.readyState === 1;
  if (!isDbConnected) {
    return [];
  }

  try {
    // 1. Fetch all real registered editors from MongoDB
    const editors = await User.find({ role: 'writer' })
      .select('name bio pricePerPage profilePic averageRating reviewCount createdAt _id')
      .lean();

    if (!editors.length) {
      return [];
    }

    // 2. Aggregate count of completed works from Deal collection
    const completedCounts = await Deal.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: '$writerId', count: { $sum: 1 } } }
    ]);

    const completedMap = new Map();
    completedCounts.forEach(c => {
      if (c && c._id) {
        completedMap.set(c._id.toString(), c.count);
      }
    });

    // 3. Map each editor with their exact completed works count
    const rankedEditors = editors.map(editor => {
      const idStr = editor._id.toString();
      const completedCount = completedMap.get(idStr) || 0;
      return {
        _id: idStr,
        name: editor.name || 'Freelance Editor',
        bio: editor.bio || '',
        pricePerPage: editor.pricePerPage || 0,
        profilePic: editor.profilePic || '',
        averageRating: Number(editor.averageRating || 0),
        reviewCount: Number(editor.reviewCount || 0),
        createdAt: editor.createdAt,
        completedCount
      };
    });

    // 4. Sort top to bottom:
    // - Highest completedCount first
    // - Higher averageRating breaks ties
    // - Higher reviewCount breaks ties
    // - Earlier join date breaks ties
    rankedEditors.sort((a, b) => {
      if (b.completedCount !== a.completedCount) {
        return b.completedCount - a.completedCount;
      }
      if (b.averageRating !== a.averageRating) {
        return b.averageRating - a.averageRating;
      }
      if (b.reviewCount !== a.reviewCount) {
        return b.reviewCount - a.reviewCount;
      }
      return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    });

    // 5. Assign rank, trophies for 1, 2, 3, and status badge
    return rankedEditors.map((editor, index) => {
      const rank = index + 1;
      let trophy = null;
      let badgeType = 'standard';

      if (rank === 1) {
        trophy = '🥇';
        badgeType = 'gold';
      } else if (rank === 2) {
        trophy = '🥈';
        badgeType = 'silver';
      } else if (rank === 3) {
        trophy = '🥉';
        badgeType = 'bronze';
      } else if (editor.completedCount === 0) {
        badgeType = 'new';
      }

      return {
        ...editor,
        rank,
        trophy,
        badgeType
      };
    });
  } catch (err) {
    console.warn('⚠️ Error calculating editor leaderboard:', err.message);
    return [];
  }
}

// GET /leaderboard - Dedicated Leaderboard page
router.get('/', async (req, res) => {
  try {
    const leaderboard = await getLeaderboardData();

    res.render('leaderboard', {
      pageTitle: 'Editor Leaderboard — PerPage Rankings',
      metaDescription: 'Real-time competitive leaderboard of freelance editors ranked by completed works, ratings, and peer reviews.',
      currentPath: '/leaderboard',
      leaderboard,
      user: req.user || null
    });
  } catch (err) {
    console.error('❌ Leaderboard page error:', err.message);
    res.status(500).render('error', {
      statusCode: 500,
      title: 'Leaderboard Unavailable',
      message: 'Could not load the editor leaderboard at this time.',
      currentPath: '/leaderboard',
      user: req.user || null
    });
  }
});

// GET /leaderboard/api or /api/leaderboard - Live polling endpoint
router.get('/api', async (req, res) => {
  try {
    const leaderboard = await getLeaderboardData();
    res.json({
      success: true,
      count: leaderboard.length,
      leaderboard,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Could not refresh leaderboard data'
    });
  }
});

export default router;
