import express from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import Deal from '../models/deal.js';

const router = express.Router();

export let PAGE_SIZE = 12;

// Helper to escape regex special characters
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Mock writers for local development & automated headless tests when DB is offline
const MOCK_WRITERS = [
  {
    _id: new mongoose.Types.ObjectId('64f1a2b3c4d5e6f7a8b9c0d1'),
    name: 'Dr. Eleanor Vance',
    bio: 'Specializing in behavioral economics, public policy analysis, and empirical research frameworks. Oxford DPhil graduate.',
    pricePerPage: 150,
    profilePic: '',
    role: 'writer',
    createdAt: new Date('2023-04-15')
  },
  {
    _id: new mongoose.Types.ObjectId('64f1a2b3c4d5e6f7a8b9c0d2'),
    name: 'Prof. Liam Davies',
    bio: 'Academic author with extensive background in comparative literature, archival research, and qualitative critique.',
    pricePerPage: 120,
    profilePic: '',
    role: 'writer',
    createdAt: new Date('2023-08-20')
  },
  {
    _id: new mongoose.Types.ObjectId('64f1a2b3c4d5e6f7a8b9c0d3'),
    name: 'Sophia Chen',
    bio: 'Biotechnology graduate researcher focusing on clinical trial syntheses, molecular biology, and APA formatting.',
    pricePerPage: 180,
    profilePic: '',
    role: 'writer',
    createdAt: new Date('2024-01-10')
  },
  {
    _id: new mongoose.Types.ObjectId('64f1a2b3c4d5e6f7a8b9c0d4'),
    name: 'Marcus Thorne',
    bio: 'Senior editor and researcher in international relations, diplomatic history, and geopolitical risk assessments.',
    pricePerPage: 210,
    profilePic: '',
    role: 'writer',
    createdAt: new Date('2024-03-05')
  },
  {
    _id: new mongoose.Types.ObjectId('64f1a2b3c4d5e6f7a8b9c0d5'),
    name: 'Amina Al-Mansoor',
    bio: 'Postdoctoral fellow in sociology and ethnographic field methods with emphasis on urban studies.',
    pricePerPage: 140,
    profilePic: '',
    role: 'writer',
    createdAt: new Date('2024-05-12')
  },
  {
    _id: new mongoose.Types.ObjectId('64f1a2b3c4d5e6f7a8b9c0d6'),
    name: 'Julian Ross',
    bio: 'Cognitive neuroscience specialist offering manuscript proofing, statistical methodology reviews, and literature scoping.',
    pricePerPage: 175,
    profilePic: '',
    role: 'writer',
    createdAt: new Date('2024-07-22')
  },
  {
    _id: new mongoose.Types.ObjectId('64f1a2b3c4d5e6f7a8b9c0d7'),
    name: 'Kavita Patel',
    bio: '', // Intentionally empty bio for testing empty bio state
    pricePerPage: 0, // Intentionally unset rate for testing unset rate state
    profilePic: '',
    role: 'writer',
    createdAt: new Date('2024-09-01')
  }
];

// GET /writers - Directory listing with search, sort, and pagination
router.get('/', async (req, res) => {
  // 1. Sanitize & Validate Query Parameters
  const rawQ = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const q = rawQ.slice(0, 80); // Cap length at 80
  const hasRate = req.query.hasRate === '1' || req.query.hasRate === 'true';

  const validSorts = ['newest', 'price_asc', 'price_desc', 'completed'];
  const sort = validSorts.includes(req.query.sort) ? req.query.sort : 'newest';

  let page = parseInt(req.query.page, 10);
  if (isNaN(page) || page < 1) {
    page = 1;
  }

  try {
    // 2. Build Query Filter
    const query = { role: 'writer' };

    if (q) {
      const escaped = escapeRegex(q);
      query.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { bio: { $regex: escaped, $options: 'i' } }
      ];
    }

    if (hasRate) {
      query.pricePerPage = { $gt: 0 };
    }

    // 3. Sorting configuration
    const sortOptions = {
      newest: { createdAt: -1 },
      price_asc: { pricePerPage: 1, createdAt: -1 },
      price_desc: { pricePerPage: -1, createdAt: -1 }
    };

    let writers = [];
    let totalCount = 0;
    const completedDealsMap = {};

    // Check if MongoDB is connected
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      totalCount = await User.countDocuments(query);
      const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
      const effectivePage = Math.min(page, totalPages);
      const skip = (effectivePage - 1) * PAGE_SIZE;

      if (sort === 'completed') {
        // Aggregate to sort by completed deals count
        writers = await User.aggregate([
          { $match: query },
          {
            $lookup: {
              from: 'deals',
              let: { wId: '$_id' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ['$writerId', '$$wId'] },
                        { $eq: ['$status', 'completed'] }
                      ]
                    }
                  }
                }
              ],
              as: 'completedDeals'
            }
          },
          { $addFields: { completedCount: { $size: '$completedDeals' } } },
          { $sort: { completedCount: -1, createdAt: -1 } },
          { $skip: skip },
          { $limit: PAGE_SIZE },
          { $project: { completedDeals: 0 } }
        ]);

        writers.forEach(w => {
          completedDealsMap[w._id.toString()] = w.completedCount || 0;
        });
      } else {
        writers = await User.find(query)
          .sort(sortOptions[sort])
          .skip(skip)
          .limit(PAGE_SIZE)
          .lean();

        // Single aggregation for completed deals across the page
        if (writers.length > 0) {
          const writerIds = writers.map(w => w._id);
          const dealAgg = await Deal.aggregate([
            { $match: { writerId: { $in: writerIds }, status: 'completed' } },
            { $group: { _id: '$writerId', count: { $sum: 1 } } }
          ]);

          dealAgg.forEach(item => {
            completedDealsMap[item._id.toString()] = item.count;
          });
        }
      }
    }

    // Dev preview fallbacks for local headless testing when DB is empty or disconnected
    if (process.env.NODE_ENV !== 'production' && (!isDbConnected || writers.length === 0)) {
      if (req.query.empty === '1') {
        writers = [];
        totalCount = 0;
      } else if (!isDbConnected || req.query.mockWriters === '1' || (!q && !hasRate)) {
        let filtered = [...MOCK_WRITERS];
        if (q) {
          const lowerQ = q.toLowerCase();
          filtered = filtered.filter(w => 
            (w.name && w.name.toLowerCase().includes(lowerQ)) || 
            (w.bio && w.bio.toLowerCase().includes(lowerQ))
          );
        }
        if (hasRate) {
          filtered = filtered.filter(w => w.pricePerPage > 0);
        }

        if (sort === 'price_asc') {
          filtered.sort((a, b) => a.pricePerPage - b.pricePerPage);
        } else if (sort === 'price_desc') {
          filtered.sort((a, b) => b.pricePerPage - a.pricePerPage);
        } else if (sort === 'completed') {
          const mockCounts = {
            '64f1a2b3c4d5e6f7a8b9c0d1': 14,
            '64f1a2b3c4d5e6f7a8b9c0d2': 9,
            '64f1a2b3c4d5e6f7a8b9c0d3': 5,
            '64f1a2b3c4d5e6f7a8b9c0d4': 2,
            '64f1a2b3c4d5e6f7a8b9c0d5': 1,
            '64f1a2b3c4d5e6f7a8b9c0d6': 0,
            '64f1a2b3c4d5e6f7a8b9c0d7': 0
          };
          filtered.sort((a, b) => (mockCounts[b._id.toString()] || 0) - (mockCounts[a._id.toString()] || 0));
        }

        totalCount = filtered.length;
        const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
        const effectivePage = Math.min(page, totalPages);
        const skip = (effectivePage - 1) * PAGE_SIZE;

        writers = filtered.slice(skip, skip + PAGE_SIZE);

        // Prepopulate sample completed deals counts
        const mockCounts = {
          '64f1a2b3c4d5e6f7a8b9c0d1': 14,
          '64f1a2b3c4d5e6f7a8b9c0d2': 9,
          '64f1a2b3c4d5e6f7a8b9c0d3': 5,
          '64f1a2b3c4d5e6f7a8b9c0d4': 2,
          '64f1a2b3c4d5e6f7a8b9c0d5': 1,
          '64f1a2b3c4d5e6f7a8b9c0d6': 0,
          '64f1a2b3c4d5e6f7a8b9c0d7': 0
        };
        writers.forEach(w => {
          completedDealsMap[w._id.toString()] = mockCounts[w._id.toString()] || 0;
        });
      }
    }

    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

    // SEO Canonical URL: exclude query params and pagination
    const canonical = 'https://perpage.onrender.com/writers';
    const isFilteredOrPaginated = !!(q || hasRate || (sort && sort !== 'newest') || page > 1);

    res.render('writers', {
      writers,
      currentPage: page,
      totalPages,
      totalCount,
      pageSize: PAGE_SIZE,
      q,
      sort,
      hasRate,
      completedDealsMap,
      user: req.user,
      canonical,
      noindex: isFilteredOrPaginated // Add noindex to filtered/paginated listing URLs beyond page 1
    });

  } catch (err) {
    console.error('❌ Writers listing query error:', err.message);
    res.status(500).render('writers', {
      writers: [],
      currentPage: 1,
      totalPages: 1,
      totalCount: 0,
      pageSize: PAGE_SIZE,
      q,
      sort,
      hasRate,
      completedDealsMap: {},
      user: req.user,
      dbError: true
    });
  }
});

// GET /writers/:id - Public writer profile
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  // 1. Validate MongoDB ObjectId safely
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).render('writerNotFound', {
      user: req.user,
      invalidId: id,
      pageTitle: 'Editor Not Found — PerPage',
      noindex: true
    });
  }

  try {
    let writer = null;
    let completedCount = 0;

    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      writer = await User.findById(id).lean();
      if (writer && writer.role === 'writer') {
        completedCount = await Deal.countDocuments({
          writerId: writer._id,
          status: 'completed'
        });
      }
    }

    // Dev preview mock fallback
    if (!writer && process.env.NODE_ENV !== 'production') {
      writer = MOCK_WRITERS.find(w => w._id.toString() === id);
      if (writer) {
        const mockCounts = {
          '64f1a2b3c4d5e6f7a8b9c0d1': 14,
          '64f1a2b3c4d5e6f7a8b9c0d2': 9,
          '64f1a2b3c4d5e6f7a8b9c0d3': 5,
          '64f1a2b3c4d5e6f7a8b9c0d4': 2,
          '64f1a2b3c4d5e6f7a8b9c0d5': 1,
          '64f1a2b3c4d5e6f7a8b9c0d6': 0,
          '64f1a2b3c4d5e6f7a8b9c0d7': 0
        };
        completedCount = mockCounts[writer._id.toString()] || 0;
      }
    }

    // 2. Safe 404 if writer not found or role is not 'writer'
    if (!writer || writer.role !== 'writer') {
      return res.status(404).render('writerNotFound', {
        user: req.user,
        invalidId: id,
        pageTitle: 'Editor Not Found — PerPage',
        noindex: true
      });
    }

    // SEO canonical URL (clean)
    const canonical = `https://perpage.onrender.com/writers/${writer._id}`;

    const viewerUser = req.user || (process.env.NODE_ENV !== 'production' && req.query.mockUser === '1' 
      ? { _id: new mongoose.Types.ObjectId('64f1a2b3c4d5e6f7a8b9c0d9'), name: 'Client Viewer' }
      : (process.env.NODE_ENV !== 'production' && req.query.mockUser === 'own' ? writer : null));

    res.render('writerProfile', {
      writer,
      completedCount,
      user: viewerUser,
      canonical,
      pageTitle: `${writer.name} — Freelance Editor | PerPage`,
      metaDescription: writer.bio 
        ? `${writer.bio.slice(0, 150)}... Upfront rate: ₹${writer.pricePerPage || 0}/page.`
        : `Document editing profile for ${writer.name} on PerPage.`
    });

  } catch (error) {
    console.error('❌ Editor profile error:', error.message);
    res.status(500).render('writerNotFound', {
      user: req.user,
      invalidId: id,
      serverError: true,
      pageTitle: 'Error Loading Editor — PerPage'
    });
  }
});

export default router;
