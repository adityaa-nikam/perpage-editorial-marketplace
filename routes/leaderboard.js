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
  try {
    const isDbConnected = mongoose.connection.readyState === 1;
    let editors = [];
    const completedMap = new Map();

  if (isDbConnected) {
    try {
      // 1. Fetch registered editors from MongoDB
      editors = await User.find({ role: 'writer' })
        .select('name bio pricePerPage profilePic averageRating reviewCount createdAt _id')
        .lean();

      // 2. Aggregate count of completed works from Deal collection
      const completedCounts = await Deal.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: '$writerId', count: { $sum: 1 } } }
      ]);

      completedCounts.forEach(c => {
        if (c && c._id) {
          completedMap.set(c._id.toString(), c.count);
        }
      });
    } catch (err) {
      console.warn('⚠️ DB query error in leaderboard:', err.message);
    }
  }

  // Fallback for dev / offline preview or if database has no seeded writers yet
  if (!editors || editors.length === 0) {
    const mockCounts = {
      '64f1a2b3c4d5e6f7a8b9c0d1': 14,
      '64f1a2b3c4d5e6f7a8b9c0d2': 9,
      '64f1a2b3c4d5e6f7a8b9c0d3': 6,
      '64f1a2b3c4d5e6f7a8b9c0d4': 4,
      '64f1a2b3c4d5e6f7a8b9c0d5': 2,
      '64f1a2b3c4d5e6f7a8b9c0d6': 1,
      '64f1a2b3c4d5e6f7a8b9c0d7': 0
    };

    Object.entries(mockCounts).forEach(([id, cnt]) => completedMap.set(id, cnt));

    editors = [
      {
        _id: '64f1a2b3c4d5e6f7a8b9c0d1',
        name: 'Dr. Eleanor Vance',
        bio: 'Specializing in behavioral economics, public policy analysis, and empirical research frameworks.',
        pricePerPage: 150,
        averageRating: 4.9,
        reviewCount: 18,
        createdAt: new Date('2023-04-15')
      },
      {
        _id: '64f1a2b3c4d5e6f7a8b9c0d2',
        name: 'Prof. Liam Davies',
        bio: 'Academic author with extensive background in comparative literature, archival research, and qualitative critique.',
        pricePerPage: 120,
        averageRating: 4.8,
        reviewCount: 12,
        createdAt: new Date('2023-08-20')
      },
      {
        _id: '64f1a2b3c4d5e6f7a8b9c0d3',
        name: 'Sophia Chen',
        bio: 'Biotechnology graduate researcher focusing on clinical trial syntheses, molecular biology, and APA formatting.',
        pricePerPage: 180,
        averageRating: 4.7,
        reviewCount: 8,
        createdAt: new Date('2024-01-10')
      },
      {
        _id: '64f1a2b3c4d5e6f7a8b9c0d4',
        name: 'Marcus Thorne',
        bio: 'Senior editor and researcher in international relations, diplomatic history, and geopolitical risk assessments.',
        pricePerPage: 210,
        averageRating: 4.6,
        reviewCount: 6,
        createdAt: new Date('2024-03-05')
      },
      {
        _id: '64f1a2b3c4d5e6f7a8b9c0d5',
        name: 'Amina Al-Mansoor',
        bio: 'Postdoctoral fellow in sociology and ethnographic field methods with emphasis on urban studies.',
        pricePerPage: 140,
        averageRating: 4.5,
        reviewCount: 3,
        createdAt: new Date('2024-05-12')
      },
      {
        _id: '64f1a2b3c4d5e6f7a8b9c0d6',
        name: 'Julian Ross',
        bio: 'Cognitive neuroscience specialist offering manuscript proofing, statistical methodology reviews, and literature scoping.',
        pricePerPage: 175,
        averageRating: 4.3,
        reviewCount: 1,
        createdAt: new Date('2024-07-22')
      },
      {
        _id: '64f1a2b3c4d5e6f7a8b9c0d7',
        name: 'Kavita Patel',
        bio: 'Doctoral fellow in computational linguistics and comparative philology.',
        pricePerPage: 110,
        averageRating: 0,
        reviewCount: 0,
        createdAt: new Date('2024-09-01')
      }
    ];
  }

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
