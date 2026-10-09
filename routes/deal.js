import express from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import crypto from 'crypto';
import path from 'path';
import { s3Client, bucketName } from '../config/s3.js';
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import Deal from '../models/deal.js';
import { User } from '../models/User.js';

const router = express.Router();

// 📁 File Constants
export const FILE_MAX_MB = 10;
export const FILE_MAX_COUNT = 1;
const FILE_MAX_BYTES = FILE_MAX_MB * 1024 * 1024;

// Mock store for in-memory testing & dev when Mongo is offline
export const MOCK_DEALS = [
  {
    _id: new mongoose.Types.ObjectId('64f1a2b3c4d5e6f7a8b9d001'),
    userId: new mongoose.Types.ObjectId('64f1a2b3c4d5e6f7a8b9c0d9'),
    writerId: new mongoose.Types.ObjectId('64f1a2b3c4d5e6f7a8b9c0d1'),
    pages: 8,
    totalPrice: 1200,
    userNotes: 'Comparative essay analyzing macroeconomic fiscal stimulus mechanisms following the 2008 crisis. APA 7th edition referencing with peer-reviewed journal sources.',
    writerNotes: '',
    status: 'pending',
    fileLinks: ['uploads/e2a1b3c4-0001-4000-8000-000000000001_macroeconomics_prompt_brief.pdf'],
    submissionFiles: [],
    finalFileLink: null,
    createdAt: new Date(Date.now() - 3600000 * 4)
  },
  {
    _id: new mongoose.Types.ObjectId('64f1a2b3c4d5e6f7a8b9d002'),
    userId: new mongoose.Types.ObjectId('64f1a2b3c4d5e6f7a8b9c0d9'),
    writerId: new mongoose.Types.ObjectId('64f1a2b3c4d5e6f7a8b9c0d1'),
    pages: 14,
    totalPrice: 2100,
    userNotes: 'Systematic literature review synthesizing attention mechanisms in large language model architectures. Include formal mathematical notation and citations.',
    writerNotes: '',
    status: 'accepted',
    fileLinks: ['uploads/e2a1b3c4-0002-4000-8000-000000000002_transformer_architectures_spec.pdf'],
    submissionFiles: [],
    finalFileLink: null,
    createdAt: new Date(Date.now() - 3600000 * 24),
    acceptedAt: new Date(Date.now() - 3600000 * 20)
  },
  {
    _id: new mongoose.Types.ObjectId('64f1a2b3c4d5e6f7a8b9d003'),
    userId: new mongoose.Types.ObjectId('64f1a2b3c4d5e6f7a8b9c0d9'),
    writerId: new mongoose.Types.ObjectId('64f1a2b3c4d5e6f7a8b9c0d1'),
    pages: 10,
    totalPrice: 1500,
    userNotes: 'Empirical term paper examining volatility clustering in emerging equity markets using GARCH modeling techniques.',
    writerNotes: 'Delivered complete manuscript with full regression diagnostic tables in appendix.',
    status: 'accepted',
    fileLinks: ['uploads/e2a1b3c4-0003-4000-8000-000000000003_time_series_syllabus.pdf'],
    submissionFiles: [],
    finalFileLink: 'https://perpagedb.s3.amazonaws.com/finals/e2a1b3c4-0003-4000-8000-000000000003_econometrics_volatility_draft.pdf',
    createdAt: new Date(Date.now() - 3600000 * 72),
    acceptedAt: new Date(Date.now() - 3600000 * 48)
  },
  {
    _id: new mongoose.Types.ObjectId('64f1a2b3c4d5e6f7a8b9d004'),
    userId: new mongoose.Types.ObjectId('64f1a2b3c4d5e6f7a8b9c0d9'),
    writerId: new mongoose.Types.ObjectId('64f1a2b3c4d5e6f7a8b9c0d1'),
    pages: 20,
    totalPrice: 3000,
    userNotes: 'Laboratory synthesis analysis of synthetic polymer crystallization kinetics.',
    writerNotes: '',
    status: 'rejected',
    fileLinks: ['uploads/e2a1b3c4-0004-4000-8000-000000000004_polymer_lab_brief.pdf'],
    submissionFiles: [],
    finalFileLink: null,
    createdAt: new Date(Date.now() - 3600000 * 96)
  },
  {
    _id: new mongoose.Types.ObjectId('64f1a2b3c4d5e6f7a8b9d005'),
    userId: new mongoose.Types.ObjectId('64f1a2b3c4d5e6f7a8b9c0d9'),
    writerId: new mongoose.Types.ObjectId('64f1a2b3c4d5e6f7a8b9c0d2'),
    pages: 6,
    totalPrice: 720,
    userNotes: 'Historical institutional analysis of Weimar Republic monetary reform policies in 1923.',
    writerNotes: '',
    status: 'completed',
    fileLinks: ['uploads/e2a1b3c4-0005-4000-8000-000000000005_weimar_monetary_history.pdf'],
    submissionFiles: [],
    finalFileLink: 'https://perpagedb.s3.amazonaws.com/finals/e2a1b3c4-0005-4000-8000-000000000005_weimar_analysis_final.pdf',
    createdAt: new Date(Date.now() - 3600000 * 120),
    completedAt: new Date(Date.now() - 3600000 * 10)
  },
  {
    _id: new mongoose.Types.ObjectId('64f1a2b3c4d5e6f7a8b9d006'),
    userId: new mongoose.Types.ObjectId('64f1a2b3c4d5e6f7a8b9c0d9'),
    writerId: new mongoose.Types.ObjectId('64f1a2b3c4d5e6f7a8b9c0d2'),
    pages: 12,
    totalPrice: 1440,
    userNotes: 'Comparative study of civil law versus common law jurisprudence regarding breach of contract doctrines.',
    writerNotes: '',
    status: 'pending',
    fileLinks: ['uploads/e2a1b3c4-0006-4000-8000-000000000006_comparative_law_brief.pdf'],
    submissionFiles: [],
    finalFileLink: null,
    createdAt: new Date(Date.now() - 3600000 * 6)
  }
];

export const MOCK_WRITERS = [
  {
    _id: new mongoose.Types.ObjectId('64f1a2b3c4d5e6f7a8b9c0d1'),
    name: 'Dr. Eleanor Vance',
    role: 'writer',
    pricePerPage: 150,
    profilePic: ''
  },
  {
    _id: new mongoose.Types.ObjectId('64f1a2b3c4d5e6f7a8b9c0d2'),
    name: 'Prof. Liam Davies',
    role: 'writer',
    pricePerPage: 120,
    profilePic: ''
  },
  {
    _id: new mongoose.Types.ObjectId('64f1a2b3c4d5e6f7a8b9c0d7'),
    name: 'Kavita Patel',
    role: 'writer',
    pricePerPage: 0, // Rate not set
    profilePic: ''
  },
  {
    _id: new mongoose.Types.ObjectId('64f1a2b3c4d5e6f7a8b9c0d9'),
    name: 'Aditi Student',
    role: 'user', // Non-writer role
    pricePerPage: 0,
    profilePic: ''
  }
];

// Dev-only inspector for test validation
if (process.env.NODE_ENV !== 'production') {
  router.get('/test-deals', (req, res) => {
    res.json(MOCK_DEALS);
  });
  router.post('/reset-mocks', (req, res) => {
    MOCK_DEALS[0].status = 'pending';
    MOCK_DEALS[0].finalFileLink = null;
    MOCK_DEALS[1].status = 'accepted';
    MOCK_DEALS[1].finalFileLink = null;
    MOCK_DEALS[2].status = 'accepted';
    MOCK_DEALS[2].finalFileLink = 'https://perpagedb.s3.amazonaws.com/finals/e2a1b3c4-0003-4000-8000-000000000003_econometrics_volatility_draft.pdf';
    MOCK_DEALS[3].status = 'rejected';
    MOCK_DEALS[3].finalFileLink = null;
    res.json({ ok: true });
  });
}

// 🔒 Authentication Guard Middleware
function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  
  // Non-production test & preview support
  if (process.env.NODE_ENV !== 'production') {
    if (req.query.mockUser === 'writer') {
      req.user = {
        _id: new mongoose.Types.ObjectId('64f1a2b3c4d5e6f7a8b9c0d1'),
        name: 'Dr. Eleanor Vance',
        email: 'eleanor@oxford.ac.uk',
        role: 'writer',
        pricePerPage: 150
      };
      return next();
    }
    if (req.query.mockUser === 'writer_b') {
      req.user = {
        _id: new mongoose.Types.ObjectId('64f1a2b3c4d5e6f7a8b9c0d2'),
        name: 'Marcus Aurelius',
        email: 'marcus@oxford.ac.uk',
        role: 'writer',
        pricePerPage: 120
      };
      return next();
    }
    if (req.query.mockUser === 'self') {
      const wId = req.query.writerId || req.body?.writerId || '64f1a2b3c4d5e6f7a8b9c0d1';
      req.user = {
        _id: new mongoose.Types.ObjectId(wId),
        name: 'Dr. Eleanor Vance',
        email: 'eleanor@oxford.ac.uk',
        role: 'writer'
      };
      return next();
    }
    if (req.headers['x-mock-user']) {
      const rawUser = req.headers['x-mock-user'];
      const isHex = typeof rawUser === 'string' && /^[0-9a-fA-F]{24}$/.test(rawUser);
      req.user = {
        _id: isHex ? new mongoose.Types.ObjectId(rawUser) : new mongoose.Types.ObjectId('64f1a2b3c4d5e6f7a8b9c0d9'),
        name: req.headers['x-mock-name'] || 'Aditi Student',
        email: req.headers['x-mock-email'] || 'qa@example.com',
        role: req.headers['x-mock-role'] || 'user',
        pricePerPage: req.headers['x-mock-rate'] ? Number(req.headers['x-mock-rate']) : 0
      };
      return next();
    }
    if (req.query.mockUser || req.body?.mockUser) {
      req.user = req.user || {
        _id: new mongoose.Types.ObjectId('64f1a2b3c4d5e6f7a8b9c0d9'),
        name: 'Aditi Student',
        email: 'qa-perpage-1@example.com',
        role: 'user'
      };
      return next();
    }
  }

  res.redirect('/login');
}

// Existing legacy upload instance preserved for untouched /upload-final routes
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Hardened Multer setup for deal initial brief upload
const dealUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: FILE_MAX_BYTES,
    files: FILE_MAX_COUNT,
    fields: 10
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      const err = new Error('Only PDF files are accepted.');
      err.code = 'INVALID_FILE_TYPE';
      return cb(err, false);
    }
    cb(null, true);
  }
});

// Middleware wrapper to intercept Multer errors and prevent unhandled 500 crashes
function dealMulterMiddleware(req, res, next) {
  dealUpload.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          req.fileError = `File exceeds the maximum size of ${FILE_MAX_MB}MB.`;
        } else if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
          req.fileError = 'Only a single PDF brief is allowed.';
        } else {
          req.fileError = `Upload error: ${err.message}`;
        }
      } else if (err.code === 'INVALID_FILE_TYPE') {
        req.fileError = 'Only PDF documents are accepted.';
      } else {
        req.fileError = err.message || 'File upload error.';
      }
    }
    next();
  });
}

// Helper: validate writerId format and lookup writer
async function findAndValidateWriter(writerId) {
  if (!writerId || typeof writerId !== 'string' || !mongoose.Types.ObjectId.isValid(writerId) || !/^[0-9a-fA-F]{24}$/.test(writerId)) {
    return { error: 'invalid_id', status: 404 };
  }

  let writer = null;
  const isDbConnected = mongoose.connection.readyState === 1;

  if (isDbConnected) {
    try {
      writer = await User.findById(writerId);
    } catch (err) {
      return { error: 'db_error', status: 500 };
    }
  } else if (process.env.NODE_ENV !== 'production') {
    writer = MOCK_WRITERS.find(w => w._id.toString() === writerId) || null;
  }

  if (!writer || writer.role !== 'writer') {
    return { error: 'not_found', status: 404 };
  }

  return { writer };
}

// Hardened Multer setup for final document upload
const finalUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: FILE_MAX_BYTES,
    files: FILE_MAX_COUNT,
    fields: 10
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      const err = new Error('Only PDF documents are accepted.');
      err.code = 'INVALID_FILE_TYPE';
      return cb(err, false);
    }
    cb(null, true);
  }
});

function finalMulterMiddleware(req, res, next) {
  finalUpload.single('finalPdf')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.redirect('/dashboard?error=upload_size');
        }
        return res.redirect('/dashboard?error=upload_failed');
      }
      if (err.code === 'INVALID_FILE_TYPE') {
        return res.redirect('/dashboard?error=upload_type');
      }
      return res.redirect('/dashboard?error=upload_failed');
    }
    next();
  });
}

// --------------------------------------------------------------------------
// HARDENED ACTIVE ROUTE: POST /deal/upload-final (Runs first)
// --------------------------------------------------------------------------
router.post('/upload-final', checkAuthenticated, finalMulterMiddleware, async (req, res) => {
  let uploadedKey = null;
  try {
    const { dealId } = req.body;
    if (!dealId || typeof dealId !== 'string' || !mongoose.Types.ObjectId.isValid(dealId) || !/^[0-9a-fA-F]{24}$/.test(dealId)) {
      return res.redirect('/dashboard?error=not_found');
    }

    const currentUserId = req.user._id || req.user.id;
    const isDbConnected = mongoose.connection.readyState === 1;
    let deal = null;

    if (isDbConnected) {
      deal = await Deal.findById(dealId);
    } else if (process.env.NODE_ENV !== 'production') {
      deal = MOCK_DEALS.find(d => d._id.toString() === dealId.toString());
    }

    if (!deal) {
      return res.redirect('/dashboard?error=not_found');
    }

    // Must be assigned writer
    if (deal.writerId.toString() !== currentUserId.toString()) {
      return res.redirect('/dashboard?error=forbidden');
    }

    // Status must be 'accepted' or 'in-progress'
    if (deal.status !== 'accepted' && deal.status !== 'in-progress') {
      return res.redirect('/dashboard?error=invalid_state');
    }

    const file = req.file;
    if (!file) {
      return res.redirect('/dashboard?error=upload_missing');
    }

    // PDF magic bytes check (%PDF-)
    if (!file.buffer || file.buffer.length < 5 || file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
      return res.redirect('/dashboard?error=upload_type');
    }

    // Server-generated safe S3 key with random UUID under finals/
    const ext = path.extname(file.originalname).toLowerCase() || '.pdf';
    const rawBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
    const safeFilename = `${rawBase || 'final'}${ext}`;
    const finalFileKey = `finals/${crypto.randomUUID()}_${safeFilename}`;
    uploadedKey = finalFileKey;

    // Upload first
    const isMockS3 = process.env.NODE_ENV !== 'production' && (process.env.MOCK_S3 === '1' || process.env.AWS_ACCESS_KEY_ID === 'dummy_aws_key');
    if (process.env.TEST_S3_FAILURE === '1' || (process.env.NODE_ENV !== 'production' && req.headers['x-test-s3-failure'] === '1')) {
      throw new Error('Simulated S3 storage failure');
    }

    if (!isMockS3) {
      const putCommand = new PutObjectCommand({
        Bucket: bucketName,
        Key: finalFileKey,
        Body: file.buffer,
        ContentType: 'application/pdf',
      });
      await s3Client.send(putCommand);
    }

    // Generate signed URL (preserving existing 7-day storage convention)
    let signedUrl = `https://${bucketName}.s3.amazonaws.com/${finalFileKey}`;
    if (!isMockS3) {
      try {
        signedUrl = await getSignedUrl(
          s3Client,
          new GetObjectCommand({ Bucket: bucketName, Key: finalFileKey }),
          { expiresIn: 60 * 60 * 24 * 7 }
        );
      } catch (signErr) {
        signedUrl = `https://${bucketName}.s3.amazonaws.com/${finalFileKey}`;
      }
    }

    // Update Deal second (status remains untouched per existing flow)
    deal.finalFileLink = signedUrl;
    if (isDbConnected) {
      await deal.save();
    }

    return res.redirect('/dashboard?uploaded=1');
  } catch (err) {
    console.error('Final file upload error:', err.message);
    if (uploadedKey) {
      try {
        if (process.env.NODE_ENV === 'production' || process.env.AWS_ACCESS_KEY_ID !== 'dummy_aws_key') {
          await s3Client.send(new DeleteObjectCommand({
            Bucket: bucketName,
            Key: uploadedKey
          }));
          console.log('Successfully cleaned up orphaned S3 object:', uploadedKey);
        }
      } catch (cleanupErr) {
        console.error('Failed to clean up orphaned S3 key:', uploadedKey, cleanupErr.message);
      }
    }
    return res.redirect('/dashboard?error=upload_failed');
  }
});

// --------------------------------------------------------------------------
// REDESIGNED & HARDENED DEAL CREATION ROUTES
// --------------------------------------------------------------------------

// 📄 GET /deal?writerId=xxx
router.get('/', checkAuthenticated, async (req, res) => {
  try {
    const rawWriterId = req.query.writerId;
    const lookup = await findAndValidateWriter(rawWriterId);

    if (lookup.error === 'invalid_id' || lookup.error === 'not_found') {
      return res.status(404).render('dealError', {
        pageTitle: 'Writer Not Found — PerPage',
        errorTitle: 'Writer Not Found',
        errorCode: '404',
        errorMessage: 'The requested author could not be found or is not registered as an academic writer.',
        robots: 'noindex, nofollow'
      });
    }

    if (lookup.error === 'db_error') {
      return res.status(500).render('dealError', {
        pageTitle: 'Server Error — PerPage',
        errorTitle: 'Database Connection Error',
        errorCode: '500',
        errorMessage: 'Unable to connect to the database. Please try again later.',
        robots: 'noindex, nofollow'
      });
    }

    const writer = lookup.writer;
    const currentUserId = req.user && (req.user._id || req.user.id);

    // Self-deal check
    if (currentUserId && currentUserId.toString() === writer._id.toString()) {
      return res.status(409).render('dealError', {
        pageTitle: 'Cannot Create Deal — PerPage',
        errorTitle: 'Self-Deal Not Permitted',
        errorCode: '409',
        errorMessage: 'You cannot commission an assignment deal with yourself.',
        robots: 'noindex, nofollow'
      });
    }

    // Rate not set check
    if (typeof writer.pricePerPage !== 'number' || writer.pricePerPage <= 0) {
      return res.status(422).render('dealError', {
        pageTitle: 'Rate Not Set — PerPage',
        errorTitle: 'Rate Not Set',
        errorCode: '422',
        errorMessage: 'This writer has not set a rate yet. Deals cannot be created until the writer sets their rate.',
        robots: 'noindex, nofollow'
      });
    }

    const nameParts = (writer.name || 'this writer').replace(/^(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s+/i, '').split(' ');
    const firstName = nameParts[0] || writer.name;
    const initials = (writer.name || 'W').split(' ').map(n => n.charAt(0)).slice(0, 2).join('').toUpperCase();

    res.render('deal', {
      writer,
      firstName,
      initials,
      FILE_MAX_MB,
      errors: {},
      values: { pages: '1', userNotes: '' }
    });
  } catch (err) {
    console.error('GET /deal error:', err.message);
    res.status(500).render('dealError', {
      pageTitle: 'Server Error — PerPage',
      errorTitle: 'Server Error',
      errorCode: '500',
      errorMessage: 'An unexpected error occurred while loading the deal page.',
      robots: 'noindex, nofollow'
    });
  }
});

// 📨 POST /deal - Create new deal and upload initial brief
router.post('/', checkAuthenticated, dealMulterMiddleware, async (req, res) => {
  const errors = {};
  const values = {
    pages: typeof req.body?.pages === 'string' ? req.body.pages : '',
    userNotes: typeof req.body?.userNotes === 'string' ? req.body.userNotes : ''
  };

  const rawWriterId = req.body?.writerId;
  const lookup = await findAndValidateWriter(rawWriterId);

  if (lookup.error === 'invalid_id' || lookup.error === 'not_found') {
    return res.status(404).render('dealError', {
      pageTitle: 'Writer Not Found — PerPage',
      errorTitle: 'Writer Not Found',
      errorCode: '404',
      errorMessage: 'The requested author could not be found or is not registered as an academic writer.',
      robots: 'noindex, nofollow'
    });
  }

  if (lookup.error === 'db_error') {
    return res.status(500).render('dealError', {
      pageTitle: 'Server Error — PerPage',
      errorTitle: 'Database Connection Error',
      errorCode: '500',
      errorMessage: 'Unable to connect to the database. Please try again later.',
      robots: 'noindex, nofollow'
    });
  }

  const writer = lookup.writer;
  const currentUserId = req.user && (req.user._id || req.user.id);

  // Self-deal check
  if (currentUserId && currentUserId.toString() === writer._id.toString()) {
    return res.status(409).render('dealError', {
      pageTitle: 'Cannot Create Deal — PerPage',
      errorTitle: 'Self-Deal Not Permitted',
      errorCode: '409',
      errorMessage: 'You cannot commission an assignment deal with yourself.',
      robots: 'noindex, nofollow'
    });
  }

  // Rate not set check
  if (typeof writer.pricePerPage !== 'number' || writer.pricePerPage <= 0) {
    return res.status(422).render('dealError', {
      pageTitle: 'Rate Not Set — PerPage',
      errorTitle: 'Rate Not Set',
      errorCode: '422',
      errorMessage: 'This writer has not set a rate yet. Deals cannot be created until the writer sets their rate.',
      robots: 'noindex, nofollow'
    });
  }

  const nameParts = (writer.name || 'this writer').replace(/^(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s+/i, '').split(' ');
  const firstName = nameParts[0] || writer.name;
  const initials = (writer.name || 'W').split(' ').map(n => n.charAt(0)).slice(0, 2).join('').toUpperCase();

  // 1. Validate pages: string, integer between 1 and 500, no decimals
  const rawPages = req.body?.pages;
  let pagesNum = 0;
  if (typeof rawPages !== 'string' || !/^\d+$/.test(rawPages.trim())) {
    errors.pages = 'Page count must be a whole number between 1 and 500.';
  } else {
    pagesNum = parseInt(rawPages.trim(), 10);
    if (pagesNum < 1 || pagesNum > 500) {
      errors.pages = 'Page count must be between 1 and 500.';
    }
  }

  // 2. Validate userNotes: optional, trimmed, max 2000 chars
  let userNotes = '';
  if (typeof req.body?.userNotes === 'string') {
    userNotes = req.body.userNotes.trim();
    if (userNotes.length > 2000) {
      errors.userNotes = 'Notes cannot exceed 2000 characters.';
    }
  }

  // 3. Validate file
  if (req.fileError) {
    errors.file = req.fileError;
  } else if (!req.file) {
    errors.file = 'Please upload your assignment brief (PDF).';
  } else {
    const file = req.file;
    if (file.mimetype !== 'application/pdf') {
      errors.file = 'Only PDF documents are accepted.';
    } else if (!file.buffer || file.buffer.length < 5 || file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
      errors.file = 'Invalid file format. The file must be a valid PDF document.';
    }
  }

  // Re-render form with status 422 if validation fails
  if (Object.keys(errors).length > 0) {
    return res.status(422).render('deal', {
      writer,
      firstName,
      initials,
      FILE_MAX_MB,
      errors,
      values
    });
  }

  // Server-computed totalPrice: pricePerPage x pages, rounded to 2 decimals
  // Browser-sent price or total is completely ignored
  const totalPrice = Math.round(writer.pricePerPage * pagesNum * 100) / 100;

  // Generate safe S3 key
  const file = req.file;
  const ext = path.extname(file.originalname).toLowerCase() || '.pdf';
  const rawBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  const safeFilename = `${rawBase || 'brief'}${ext}`;
  const fileKey = `uploads/${crypto.randomUUID()}_${safeFilename}`;

  // Step 1: Upload to S3 first
  try {
    const isMockS3 = process.env.NODE_ENV !== 'production' && (process.env.MOCK_S3 === '1' || process.env.AWS_ACCESS_KEY_ID === 'dummy_aws_key');
    if (process.env.TEST_S3_FAILURE === '1' || (process.env.NODE_ENV !== 'production' && req.headers['x-test-s3-failure'] === '1')) {
      throw new Error('Simulated S3 storage failure');
    }

    if (!isMockS3) {
      const putCommand = new PutObjectCommand({
        Bucket: bucketName,
        Key: fileKey,
        Body: file.buffer,
        ContentType: 'application/pdf',
      });
      await s3Client.send(putCommand);
    }
  } catch (s3Err) {
    console.error('S3 upload failure for key:', fileKey, s3Err.message);
    errors.file = 'Failed to upload document to storage. Please try again.';
    return res.status(422).render('deal', {
      writer,
      firstName,
      initials,
      FILE_MAX_MB,
      errors,
      values
    });
  }

  // Step 2: Save Deal to DB second
  try {
    if (process.env.TEST_DB_FAILURE === '1' || (process.env.NODE_ENV !== 'production' && req.headers['x-test-db-failure'] === '1')) {
      throw new Error('Simulated database write failure');
    }

    const isDbConnected = mongoose.connection.readyState === 1;
    let savedDeal = null;

    if (isDbConnected) {
      const deal = new Deal({
        userId: currentUserId,
        writerId: writer._id,
        pages: pagesNum,
        totalPrice,
        userNotes,
        writerNotes: typeof req.body?.writerNotes === 'string' ? req.body.writerNotes.trim().slice(0, 2000) : '',
        status: 'pending',
        fileLinks: [fileKey],
        submissionFiles: [],
        finalFileLink: null
      });
      await deal.save();
      savedDeal = deal;
    } else if (process.env.NODE_ENV !== 'production') {
      savedDeal = {
        _id: new mongoose.Types.ObjectId(),
        userId: currentUserId,
        writerId: writer._id,
        pages: pagesNum,
        totalPrice,
        userNotes,
        writerNotes: '',
        status: 'pending',
        fileLinks: [fileKey],
        submissionFiles: [],
        finalFileLink: null,
        createdAt: new Date()
      };
      MOCK_DEALS.push(savedDeal);
    }

    // Redirect to dashboard with ?created=1
    res.redirect('/dashboard?created=1');
  } catch (dbErr) {
    console.error('Database deal creation failure after upload. Attempting S3 orphan cleanup for key:', fileKey);
    try {
      if (process.env.NODE_ENV === 'production' || process.env.AWS_ACCESS_KEY_ID !== 'dummy_aws_key') {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: bucketName,
          Key: fileKey
        }));
        console.log('Successfully cleaned up orphaned S3 object:', fileKey);
      }
    } catch (cleanupErr) {
      console.error('Failed to clean up orphaned S3 key:', fileKey, cleanupErr.message);
    }

    errors.form = 'Unable to finalize deal in database. Please try again.';
    return res.status(500).render('deal', {
      writer,
      firstName,
      initials,
      FILE_MAX_MB,
      errors,
      values
    });
  }
});

// --------------------------------------------------------------------------
// DEAL ACTION ROUTES: /accept/:id, /reject/:id
// --------------------------------------------------------------------------

// ✅ Accept deal
router.post('/accept/:id', checkAuthenticated, async (req, res) => {
  try {
    const dealId = req.params.id;
    if (!dealId || typeof dealId !== 'string' || !mongoose.Types.ObjectId.isValid(dealId) || !/^[0-9a-fA-F]{24}$/.test(dealId)) {
      return res.redirect('/dashboard?error=not_found');
    }

    const currentUserId = req.user._id || req.user.id;
    const isDbConnected = mongoose.connection.readyState === 1;
    let deal = null;

    if (isDbConnected) {
      deal = await Deal.findById(dealId);
    } else if (process.env.NODE_ENV !== 'production') {
      deal = MOCK_DEALS.find(d => d._id.toString() === dealId.toString());
    }

    if (!deal) {
      return res.redirect('/dashboard?error=not_found');
    }

    // Must be assigned writer
    if (deal.writerId.toString() !== currentUserId.toString()) {
      return res.redirect('/dashboard?error=forbidden');
    }

    // Must currently be in 'pending' status
    if (deal.status !== 'pending') {
      return res.redirect('/dashboard?error=invalid_state');
    }

    deal.status = 'accepted';
    deal.acceptedAt = new Date();
    if (isDbConnected) {
      await deal.save();
    }

    res.redirect('/dashboard?accepted=1');
  } catch (err) {
    console.error('Deal accept error:', err.message);
    res.redirect('/dashboard?error=invalid_state');
  }
});

// ❌ Reject deal
router.post('/reject/:id', checkAuthenticated, async (req, res) => {
  try {
    const dealId = req.params.id;
    if (!dealId || typeof dealId !== 'string' || !mongoose.Types.ObjectId.isValid(dealId) || !/^[0-9a-fA-F]{24}$/.test(dealId)) {
      return res.redirect('/dashboard?error=not_found');
    }

    const currentUserId = req.user._id || req.user.id;
    const isDbConnected = mongoose.connection.readyState === 1;
    let deal = null;

    if (isDbConnected) {
      deal = await Deal.findById(dealId);
    } else if (process.env.NODE_ENV !== 'production') {
      deal = MOCK_DEALS.find(d => d._id.toString() === dealId.toString());
    }

    if (!deal) {
      return res.redirect('/dashboard?error=not_found');
    }

    // Must be assigned writer
    if (deal.writerId.toString() !== currentUserId.toString()) {
      return res.redirect('/dashboard?error=forbidden');
    }

    // Must currently be in 'pending' status
    if (deal.status !== 'pending') {
      return res.redirect('/dashboard?error=invalid_state');
    }

    deal.status = 'rejected';
    if (isDbConnected) {
      await deal.save();
    }

    res.redirect('/dashboard?rejected=1');
  } catch (err) {
    console.error('Deal reject error:', err.message);
    res.redirect('/dashboard?error=invalid_state');
  }
});

export default router;
