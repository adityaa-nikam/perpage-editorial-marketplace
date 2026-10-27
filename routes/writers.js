import express from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import Deal from '../models/deal.js';
import Review from '../models/Review.js';

const router = express.Router();

export let PAGE_SIZE = 12;

// Helper to escape regex special characters
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

import { REAL_EDITORS, COMPLETED_DEALS_MAPPING } from '../config/editorsData.js';

const MOCK_WRITERS = REAL_EDITORS;

// GET /writers - Directory listing with search, sort, and pagination
router.get('/', async (req, res) => {
  // 1. Sanitize & Validate Query Parameters
  const rawQ = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const q = rawQ.slice(0, 80); // Cap length at 80
  const hasRate = req.query.hasRate === '1' || req.query.hasRate === 'true';

  const validSorts = ['newest', 'rating', 'price_asc', 'price_desc', 'completed'];
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
      rating: { averageRating: -1, reviewCount: -1, createdAt: -1 },
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
          filtered.sort((a, b) => (COMPLETED_DEALS_MAPPING[b._id.toString()] || 0) - (COMPLETED_DEALS_MAPPING[a._id.toString()] || 0));
        } else if (sort === 'rating') {
          filtered.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
        } else if (sort === 'newest') {
          filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }

        totalCount = filtered.length;
        const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
        const effectivePage = Math.min(page, totalPages);
        const skip = (effectivePage - 1) * PAGE_SIZE;

        writers = filtered.slice(skip, skip + PAGE_SIZE);

        // Prepopulate completed deals counts from authentic editorial mapping
        writers.forEach(w => {
          completedDealsMap[w._id.toString()] = COMPLETED_DEALS_MAPPING[w._id.toString()] || 0;
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
        completedCount = COMPLETED_DEALS_MAPPING[writer._id.toString()] || 0;
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

    let reviews = [];
    let averageRating = writer.averageRating || 0;
    let reviewCount = writer.reviewCount || 0;

    if (isDbConnected) {
      reviews = await Review.find({ writerId: writer._id })
        .populate('userId', 'name profilePic')
        .sort({ createdAt: -1 })
        .lean();

      if (reviews.length > 0) {
        reviewCount = reviews.length;
        const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
        averageRating = Math.round((sum / reviews.length) * 10) / 10;
      }
    }

    // Dev preview fallback reviews
    if (reviews.length === 0 && writer.sampleReviews && writer.sampleReviews.length > 0) {
      reviews = writer.sampleReviews;
      reviewCount = reviews.length;
      const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
      averageRating = Math.round((sum / reviews.length) * 10) / 10;
    }

    // SEO canonical URL (clean)
    const canonical = `https://perpage.onrender.com/writers/${writer._id}`;

    const viewerUser = req.user || (process.env.NODE_ENV !== 'production' && req.query.mockUser === '1' 
      ? { _id: new mongoose.Types.ObjectId('64f1a2b3c4d5e6f7a8b9c0d9'), name: 'Client Viewer' }
      : (process.env.NODE_ENV !== 'production' && req.query.mockUser === 'own' ? writer : null));

    res.render('writerProfile', {
      writer,
      completedCount,
      reviews,
      averageRating,
      reviewCount,
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
