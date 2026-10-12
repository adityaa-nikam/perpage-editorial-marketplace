import express from 'express';
import mongoose from 'mongoose';
import Deal from '../models/deal.js';
import { User } from '../models/User.js';
import { s3Client, bucketName } from '../config/s3.js';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { MOCK_DEALS, MOCK_WRITERS, FILE_MAX_MB } from './deal.js';
import { getUserNotifications, getUnreadCount } from '../utils/notifications.js';

const router = express.Router();

export const PAGE_SIZE = 10;

// Whitelisted notice definitions
export const NOTICE_MAP = {
  created: { type: 'success', text: 'Deal created successfully. The editor will review your request.' },
  accepted: { type: 'success', text: 'Deal accepted. You can now review the draft and upload the edited document.' },
  paid: { type: 'success', text: 'Payment completed successfully via Razorpay test mode.' },
  rejected: { type: 'success', text: 'Deal declined.' },
  deleted: { type: 'success', text: 'Declined request removed from your dashboard.' },
  uploaded: { type: 'success', text: 'Edited document uploaded successfully.' },
  invalid_state: { type: 'error', text: 'This deal is no longer in a state that allows that action.' },
  not_found: { type: 'error', text: 'The requested deal could not be found.' },
  forbidden: { type: 'error', text: 'You are not authorized to perform that action on this deal.' },
  upload_size: { type: 'error', text: `File exceeds the maximum size limit (${FILE_MAX_MB}MB).` },
  upload_type: { type: 'error', text: 'Only valid PDF documents are accepted.' },
  upload_missing: { type: 'error', text: 'Please select a PDF document to upload.' },
  upload_failed: { type: 'error', text: 'Failed to upload document. Please try again.' },
  completed: { type: 'success', text: 'Deal marked as completed. You have confirmed receipt of the edited document.' },
  unauthorized: { type: 'error', text: 'You are not authorized to complete this deal.' },
  not_delivered: { type: 'error', text: 'This deal cannot be completed until an edited file has been delivered.' },
  invalid_deal: { type: 'error', text: 'Invalid deal identifier provided.' }
};

// Middleware to protect route
function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();

  // Dev & preview fallback
  if (process.env.NODE_ENV !== 'production') {
    if (req.query.mockUser === 'writer' || req.query.mockUser === '1') {
      req.user = {
        _id: new mongoose.Types.ObjectId('64f1a2b3c4d5e6f7a8b9c0d1'),
        name: 'Dr. Eleanor Vance',
        email: 'eleanor@oxford.ac.uk',
        role: 'writer',
        pricePerPage: 150
      };
      return next();
    }
    if (req.query.mockUser === 'writer_norate') {
      req.user = {
        _id: new mongoose.Types.ObjectId('64f1a2b3c4d5e6f7a8b9c0d7'),
        name: 'Kavita Patel',
        email: 'kavita@perpage.edu',
        role: 'writer',
        pricePerPage: 0
      };
      return next();
    }
    if (req.query.mockUser === 'student' || req.query.mockUser === '2') {
      req.user = {
        _id: new mongoose.Types.ObjectId('64f1a2b3c4d5e6f7a8b9c0d9'),
        name: 'Aditi Student',
        email: 'student@perpage.edu',
        role: 'user',
        pricePerPage: 0
      };
      return next();
    }
    if (req.headers['x-mock-user']) {
      req.user = {
        _id: new mongoose.Types.ObjectId(req.headers['x-mock-user']),
        name: 'QA Mock User',
        role: req.headers['x-mock-role'] || 'user',
        pricePerPage: req.headers['x-mock-rate'] ? Number(req.headers['x-mock-rate']) : 0
      };
      return next();
    }
  }

  if (req.method === 'GET' && req.session) {
    req.session.returnTo = req.originalUrl;
  }
  res.redirect('/login');
}

// Extract S3 key from URL or raw key string
export function extractS3KeyFromUrl(urlOrKey) {
  if (!urlOrKey || typeof urlOrKey !== 'string') return null;
  if (urlOrKey.startsWith('finals/')) return urlOrKey;
  try {
    const parsed = new URL(urlOrKey);
    let pathname = decodeURIComponent(parsed.pathname);
    if (pathname.startsWith('/')) pathname = pathname.slice(1);
    const finalsIdx = pathname.indexOf('finals/');
    if (finalsIdx !== -1) {
      return pathname.slice(finalsIdx);
    }
    return null;
  } catch (e) {
    return null;
  }
}

router.get('/', checkAuthenticated, async (req, res) => {
  try {
    const currentUserId = req.user._id || req.user.id;
    const isDbConnected = mongoose.connection.readyState === 1;

    // Sanitize and whitelist query parameters (reject objects and arrays)
    let statusParam = 'all';
    if (typeof req.query.status === 'string') {
      const s = req.query.status.trim().toLowerCase();
      if (['all', 'pending', 'active', 'delivered', 'completed', 'declined'].includes(s)) {
        statusParam = s;
      }
    }

    let viewParam = null;
    if (typeof req.query.view === 'string') {
      const v = req.query.view.trim().toLowerCase();
      if (['incoming', 'orders'].includes(v)) {
        viewParam = v;
      }
    }

    let page = 1;
    if (typeof req.query.page === 'string') {
      const p = parseInt(req.query.page, 10);
      if (!isNaN(p) && p > 0) page = p;
    }

    // Determine view availability (Incoming vs Orders)
    let incomingCount = 0;
    let ordersCount = 0;

    if (isDbConnected) {
      incomingCount = await Deal.countDocuments({ writerId: currentUserId });
      ordersCount = await Deal.countDocuments({ userId: currentUserId });
    } else if (process.env.NODE_ENV !== 'production') {
      incomingCount = MOCK_DEALS.filter(d => d.writerId && d.writerId.toString() === currentUserId.toString()).length;
      ordersCount = MOCK_DEALS.filter(d => d.userId && d.userId.toString() === currentUserId.toString()).length;
    }

    const hasBothViews = (incomingCount > 0 && ordersCount > 0);
    let currentView;
    if (hasBothViews) {
      currentView = viewParam || (req.user.role === 'writer' ? 'incoming' : 'orders');
    } else if (req.user.role === 'writer' || incomingCount > 0) {
      currentView = (viewParam === 'orders' && ordersCount > 0) ? 'orders' : 'incoming';
    } else {
      currentView = 'orders';
    }

    // Base query match for current view
    const baseMatch = (currentView === 'incoming') 
      ? { writerId: currentUserId } 
      : { userId: currentUserId };

    // Status query mapping
    const query = { ...baseMatch };
    if (statusParam === 'pending') {
      query.status = 'pending';
    } else if (statusParam === 'active') {
      query.status = { $in: ['accepted', 'in-progress'] };
      query.$or = [
        { finalFileLink: null },
        { finalFileLink: '' },
        { finalFileLink: { $exists: false } }
      ];
    } else if (statusParam === 'delivered') {
      query.$or = [
        { status: 'submitted' },
        { finalFileLink: { $exists: true, $nin: [null, ''] } }
      ];
    } else if (statusParam === 'completed') {
      query.status = 'completed';
    } else if (statusParam === 'declined') {
      query.status = 'rejected';
    }

    // Status Counts Aggregation (Single Aggregation, No N+1)
    let counts = { all: 0, pending: 0, active: 0, delivered: 0, completed: 0, declined: 0 };

    if (isDbConnected) {
      const countsAgg = await Deal.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: null,
            all: { $sum: 1 },
            pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
            active: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $in: ['$status', ['accepted', 'in-progress']] },
                      {
                        $or: [
                          { $eq: ['$finalFileLink', null] },
                          { $eq: ['$finalFileLink', ''] },
                          { $not: ['$finalFileLink'] }
                        ]
                      }
                    ]
                  },
                  1,
                  0
                ]
              }
            },
            delivered: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $eq: ['$status', 'submitted'] },
                      {
                        $and: [
                          { $ne: ['$finalFileLink', null] },
                          { $ne: ['$finalFileLink', ''] }
                        ]
                      }
                    ]
                  },
                  1,
                  0
                ]
              }
            },
            completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
            declined: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } }
          }
        }
      ]);

      if (countsAgg.length > 0) {
        counts = {
          all: countsAgg[0].all || 0,
          pending: countsAgg[0].pending || 0,
          active: countsAgg[0].active || 0,
          delivered: countsAgg[0].delivered || 0,
          completed: countsAgg[0].completed || 0,
          declined: countsAgg[0].declined || 0
        };
      }
    } else if (process.env.NODE_ENV !== 'production') {
      const viewDeals = MOCK_DEALS.filter(d => 
        currentView === 'incoming' 
          ? d.writerId && d.writerId.toString() === currentUserId.toString() 
          : d.userId && d.userId.toString() === currentUserId.toString()
      );
      counts.all = viewDeals.length;
      counts.pending = viewDeals.filter(d => d.status === 'pending').length;
      counts.active = viewDeals.filter(d => ['accepted', 'in-progress'].includes(d.status) && !d.finalFileLink).length;
      counts.delivered = viewDeals.filter(d => d.status === 'submitted' || !!d.finalFileLink).length;
      counts.completed = viewDeals.filter(d => d.status === 'completed').length;
      counts.declined = viewDeals.filter(d => d.status === 'rejected').length;
    }

    // Fetch Deals with Pagination & Counterpart Population (name, profilePic, _id ONLY)
    const counterpartField = (currentView === 'incoming') ? 'userId' : 'writerId';
    let deals = [];
    let totalFiltered = 0;

    if (isDbConnected) {
      totalFiltered = await Deal.countDocuments(query);
      deals = await Deal.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .populate(counterpartField, 'name profilePic _id')
        .lean();
    } else if (process.env.NODE_ENV !== 'production') {
      let filtered = MOCK_DEALS.filter(d => {
        const belongs = currentView === 'incoming'
          ? d.writerId && d.writerId.toString() === currentUserId.toString()
          : d.userId && d.userId.toString() === currentUserId.toString();
        if (!belongs) return false;

        if (statusParam === 'pending') return d.status === 'pending';
        if (statusParam === 'active') return ['accepted', 'in-progress'].includes(d.status) && !d.finalFileLink;
        if (statusParam === 'delivered') return d.status === 'submitted' || !!d.finalFileLink;
        if (statusParam === 'completed') return d.status === 'completed';
        if (statusParam === 'declined') return d.status === 'rejected';
        return true;
      });

      totalFiltered = filtered.length;
      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      deals = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(d => {
        const copy = { ...d };
        if (currentView === 'incoming') {
          copy.userId = { _id: d.userId, name: 'Aditi Student' };
        } else {
          const w = MOCK_WRITERS.find(mw => mw._id.toString() === d.writerId.toString());
          copy.writerId = w || { _id: d.writerId, name: 'Dr. Eleanor Vance', profilePic: '' };
        }
        return copy;
      });
    }

    // Freshly Sign URLs on Page Load (Safe try/catch per link)
    const isMockS3 = process.env.NODE_ENV !== 'production' && (process.env.MOCK_S3 === '1' || process.env.AWS_ACCESS_KEY_ID === 'dummy_aws_key');

    for (const deal of deals) {
      deal.briefLinks = [];
      if (deal.fileLinks && deal.fileLinks.length > 0) {
        for (const key of deal.fileLinks) {
          try {
            let signedUrl = '#';
            if (!isMockS3) {
              const command = new GetObjectCommand({
                Bucket: bucketName,
                Key: key
              });
              signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });
            } else {
              signedUrl = `/mock-download/${encodeURIComponent(key)}?expires=${Date.now() + 300000}`;
            }
            const cleanName = key.replace(/^uploads\/[a-f0-9-]{36}_/, '').replace(/^uploads\/\d+_/, '');
            deal.briefLinks.push({
              url: signedUrl,
              filename: cleanName || 'draft_document.pdf'
            });
          } catch (signErr) {
            deal.briefLinks.push({
              url: null,
              filename: 'draft_document.pdf',
              unavailable: true
            });
          }
        }
      }

      deal.freshFinalLink = null;
      deal.finalLinkUnavailable = false;
      deal.finalFilename = 'final_delivery.pdf';

      if (deal.finalFileLink) {
        const key = extractS3KeyFromUrl(deal.finalFileLink);
        if (key && key.startsWith('finals/')) {
          try {
            if (!isMockS3) {
              const command = new GetObjectCommand({
                Bucket: bucketName,
                Key: key
              });
              deal.freshFinalLink = await getSignedUrl(s3Client, command, { expiresIn: 300 });
            } else {
              deal.freshFinalLink = `/mock-download/${encodeURIComponent(key)}?expires=${Date.now() + 300000}`;
            }
            const cleanName = key.replace(/^finals\/[a-f0-9-]{36}_/, '').replace(/^finals\/\d+_/, '');
            deal.finalFilename = cleanName || 'final_delivery.pdf';
          } catch (err) {
            deal.freshFinalLink = null;
            deal.finalLinkUnavailable = true;
          }
        } else {
          deal.freshFinalLink = null;
          deal.finalLinkUnavailable = true;
        }
      }
    }

    // Map Whitelisted Notice Code
    let notice = null;
    if (req.query.created) notice = NOTICE_MAP.created;
    else if (req.query.paid) notice = NOTICE_MAP.paid;
    else if (req.query.accepted) notice = NOTICE_MAP.accepted;
    else if (req.query.rejected) notice = NOTICE_MAP.rejected;
    else if (req.query.uploaded) notice = NOTICE_MAP.uploaded;
    else if (req.query.completed) notice = NOTICE_MAP.completed;
    else if (typeof req.query.error === 'string' && NOTICE_MAP[req.query.error]) {
      notice = NOTICE_MAP[req.query.error];
    }

    // Suppress raw messages from index.js query reflection
    res.locals.messages = { error: null, success: null, info: null };

    const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));

    // Fetch in-app notifications for the user
    let userNotifications = [];
    let unreadCount = 0;
    try {
      userNotifications = await getUserNotifications(currentUserId, 10);
      unreadCount = await getUnreadCount(currentUserId);
    } catch (notifFetchErr) {
      console.error('Error fetching notifications for dashboard:', notifFetchErr.message);
    }

    return res.render('dashboard', {
      user: req.user,
      deals,
      counts,
      currentStatus: statusParam,
      currentView,
      hasBothViews,
      page,
      totalPages,
      totalFiltered,
      notice,
      FILE_MAX_MB,
      userNotifications,
      unreadCount
    });
  } catch (err) {
    console.error('Dashboard error:', err.message);
    res.status(500).render('dashboardError', {
      pageTitle: 'Dashboard Error — PerPage',
      user: req.user || null,
      errorMsg: 'Unable to load dashboard records. Please try again.'
    });
  }
});

export default router;
