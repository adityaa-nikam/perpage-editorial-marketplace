import express from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import Deal from '../models/deal.js';
import { MOCK_DEALS } from './deal.js';
import { RAZORPAY_KEY_ID, createRazorpayOrder, verifyRazorpaySignature } from '../config/razorpay.js';
import { createNotification, MOCK_NOTIFICATIONS } from '../utils/notifications.js';
import Notification from '../models/Notification.js';
import { sendRazorpayReceiptEmail } from '../utils/receiptMailer.js';

const router = express.Router();

function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  // Support mock user for local dev/testing
  if (process.env.NODE_ENV !== 'production') {
    if (req.headers['x-mock-user']) {
      const rawUser = req.headers['x-mock-user'];
      const isHex = typeof rawUser === 'string' && /^[0-9a-fA-F]{24}$/.test(rawUser);
      req.user = {
        _id: isHex ? new mongoose.Types.ObjectId(rawUser) : new mongoose.Types.ObjectId('64f1a2b3c4d5e6f7a8b9c0d9'),
        name: req.headers['x-mock-name'] || 'Aditi Student',
        email: req.headers['x-mock-email'] || 'qa@example.com',
        role: req.headers['x-mock-role'] || 'user'
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
  return res.status(401).json({ error: 'unauthorized', message: 'You must be signed in to perform this action.' });
}

// POST /payment/create-order
router.post('/create-order', checkAuthenticated, async (req, res) => {
  try {
    const { dealId } = req.body;
    if (!dealId) {
      return res.status(400).json({ error: 'bad_request', message: 'Deal ID is required.' });
    }

    let deal = null;
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected && mongoose.Types.ObjectId.isValid(dealId)) {
      deal = await Deal.findById(dealId);
    } else if (process.env.NODE_ENV !== 'production' && Array.isArray(MOCK_DEALS)) {
      deal = MOCK_DEALS.find(d => d._id.toString() === dealId.toString());
    }

    if (!deal) {
      return res.status(404).json({ error: 'not_found', message: 'Deal not found.' });
    }

    // Verify ownership: client who owns the deal can pay
    const currentUserId = req.user && (req.user._id || req.user.id);
    if (currentUserId && deal.userId && deal.userId.toString() !== currentUserId.toString()) {
      return res.status(403).json({ error: 'forbidden', message: 'You are not authorized to pay for this deal.' });
    }

    if (deal.paymentStatus === 'paid') {
      return res.status(400).json({ error: 'already_paid', message: 'This deal is already marked as paid.' });
    }

    // Workflow Guard: Editor must accept the order before client can pay
    if (deal.status === 'pending') {
      return res.status(400).json({ 
        error: 'not_accepted', 
        message: 'This order request has not been accepted by the editor yet. Payment is only unlocked once the editor accepts your request.' 
      });
    }

    if (deal.status === 'rejected') {
      return res.status(400).json({ 
        error: 'declined', 
        message: 'This order request was declined and cannot be paid for.' 
      });
    }

    if (deal.status !== 'accepted' && deal.status !== 'in-progress') {
      return res.status(400).json({ 
        error: 'invalid_status', 
        message: 'Payment cannot be processed for orders in this state.' 
      });
    }

    // Create Razorpay Order
    const order = await createRazorpayOrder({
      amount: deal.totalPrice,
      currency: 'INR',
      receipt: `deal_${deal._id}`,
      notes: {
        dealId: deal._id.toString(),
        userId: currentUserId ? currentUserId.toString() : 'guest'
      }
    });

    // Save order ID to deal
    if (isDbConnected && typeof deal.save === 'function') {
      deal.razorpayOrderId = order.id;
      await deal.save();
    } else if (deal) {
      deal.razorpayOrderId = order.id;
    }

    return res.json({
      success: true,
      order,
      keyId: RAZORPAY_KEY_ID,
      deal: {
        id: deal._id,
        totalPrice: deal.totalPrice,
        pages: deal.pages
      }
    });
  } catch (err) {
    console.error('Error creating Razorpay order:', err.message);
    return res.status(500).json({ error: 'order_creation_failed', message: 'Unable to initiate payment with Razorpay.' });
  }
});

// POST /payment/verify
router.post('/verify', checkAuthenticated, async (req, res) => {
  try {
    const { dealId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!dealId || !razorpay_payment_id) {
      return res.status(400).json({ error: 'bad_request', message: 'Payment details are missing.' });
    }

    const isValid = verifyRazorpaySignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature
    });

    if (!isValid) {
      return res.status(400).json({ error: 'invalid_signature', message: 'Payment verification failed.' });
    }

    // Update Deal in DB
    const isDbConnected = mongoose.connection.readyState === 1;
    let deal = null;

    if (isDbConnected && mongoose.Types.ObjectId.isValid(dealId)) {
      deal = await Deal.findById(dealId).populate('userId', 'name email').populate('writerId', 'name email');
      if (deal) {
        deal.paymentStatus = 'paid';
        if (deal.status === 'accepted') {
          deal.status = 'in-progress';
        }
        deal.razorpayPaymentId = razorpay_payment_id;
        deal.razorpayOrderId = razorpay_order_id || deal.razorpayOrderId;
        deal.razorpaySignature = razorpay_signature || '';
        deal.paidAt = new Date();
        await deal.save();
      }
    } else if (process.env.NODE_ENV !== 'production' && Array.isArray(MOCK_DEALS)) {
      deal = MOCK_DEALS.find(d => d._id.toString() === dealId.toString());
      if (deal) {
        deal.paymentStatus = 'paid';
        if (deal.status === 'accepted') {
          deal.status = 'in-progress';
        }
        deal.razorpayPaymentId = razorpay_payment_id;
        deal.paidAt = new Date();
      }
    }

    if (deal) {
      const clientObj = deal.userId || req.user || { name: 'Client', email: req.user?.email || '' };
      const editorObj = deal.writerId || { name: 'Freelance Editor', email: '' };
      const dealShortId = deal._id ? deal._id.toString().slice(-6).toUpperCase() : '000000';

      // 1. Dispatch official Razorpay payment receipt email asynchronously (non-blocking)
      sendRazorpayReceiptEmail({
        client: clientObj,
        editor: editorObj,
        deal,
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        paidAt: deal.paidAt || new Date()
      }).catch(mailErr => {
        console.error('Receipt email dispatch error:', mailErr.message);
      });

      // Auto-resolve pending payment notification for this deal
      try {
        if (isDbConnected) {
          await Notification.updateMany(
            { dealId: deal._id, type: { $in: ['order_accepted', 'payment_pending'] } },
            { $set: { read: true } }
          );
        } else if (Array.isArray(MOCK_NOTIFICATIONS)) {
          MOCK_NOTIFICATIONS.forEach(n => {
            if (n.dealId === deal._id.toString() && ['order_accepted', 'payment_pending'].includes(n.type)) {
              n.read = true;
            }
          });
        }
      } catch (notifResolveErr) {
        console.warn('Could not auto-resolve pending payment notification:', notifResolveErr.message);
      }

      // 2. Notify Editor: Send payment receipt notification with ID for cross-checking
      if (deal.writerId) {
        try {
          const editorTargetId = deal.writerId._id || deal.writerId;
          await createNotification({
            recipient: editorTargetId,
            sender: (req.user && (req.user._id || req.user.id)) || null,
            dealId: deal._id,
            type: 'payment_received',
            title: 'Payment Receipt (Cross-Check)',
            message: `Client paid ₹${deal.totalPrice || 0} via Razorpay (ID: ${razorpay_payment_id}). Receipt is ready to cross-check.`,
            link: `/dashboard?view=incoming&receiptDealId=${deal._id}`
          });
        } catch (notifErr) {
          console.error('Payment notification to editor error:', notifErr.message);
        }
      }

      // 3. Notify Client: Confirmation that payment succeeded and email was dispatched
      if (deal.userId) {
        try {
          const clientTargetId = deal.userId._id || deal.userId;
          await createNotification({
            recipient: clientTargetId,
            sender: null,
            dealId: deal._id,
            type: 'payment_received',
            title: 'Payment Successful',
            message: `Your payment of ₹${deal.totalPrice || 0} (ID: ${razorpay_payment_id}) was processed successfully. An email receipt has been sent to ${clientObj.email || 'your email'}.`,
            link: `/dashboard?view=orders&receiptDealId=${deal._id}`
          });
        } catch (notifErr) {
          console.error('Payment notification to client error:', notifErr.message);
        }
      }
    }

    return res.json({
      success: true,
      message: 'Payment verified successfully.',
      paymentId: razorpay_payment_id
    });
  } catch (err) {
    console.error('Error verifying Razorpay payment:', err.message);
    return res.status(500).json({ error: 'verification_error', message: 'Error processing payment verification.' });
  }
});

// GET /payment/check-status/:dealId — Check if a deal has been paid
router.get('/check-status/:dealId', checkAuthenticated, async (req, res) => {
  try {
    const { dealId } = req.params;
    if (!dealId || typeof dealId !== 'string') {
      return res.status(400).json({ error: 'invalid_id', isPaid: false });
    }

    let deal = null;
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected && mongoose.Types.ObjectId.isValid(dealId)) {
      deal = await Deal.findById(dealId).select('paymentStatus status').lean();
    } else if (Array.isArray(MOCK_DEALS)) {
      deal = MOCK_DEALS.find(d => d._id.toString() === dealId.toString());
    }

    const isPaid = deal && (deal.paymentStatus === 'paid' || deal.status === 'in-progress');
    return res.json({ 
      success: true, 
      isPaid: Boolean(isPaid), 
      paymentStatus: deal?.paymentStatus || 'unpaid', 
      status: deal?.status || 'pending' 
    });
  } catch (err) {
    return res.status(500).json({ error: 'error', isPaid: false });
  }
});

// GET /payment/receipt/:dealId — Provides structured receipt data for cross-checking
router.get('/receipt/:dealId', checkAuthenticated, async (req, res) => {
  try {
    const { dealId } = req.params;
    if (!dealId) {
      return res.status(400).json({ error: 'bad_request', message: 'Deal ID is required.' });
    }

    let deal = null;
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected && mongoose.Types.ObjectId.isValid(dealId)) {
      deal = await Deal.findById(dealId).populate('userId', 'name email').populate('writerId', 'name email');
    } else if (process.env.NODE_ENV !== 'production' && Array.isArray(MOCK_DEALS)) {
      deal = MOCK_DEALS.find(d => d._id.toString() === dealId.toString());
    }

    if (!deal) {
      return res.status(404).json({ error: 'not_found', message: 'Deal not found.' });
    }

    const currentUserId = req.user && (req.user._id || req.user.id);
    const clientUserId = deal.userId?._id ? deal.userId._id.toString() : deal.userId?.toString();
    const editorUserId = deal.writerId?._id ? deal.writerId._id.toString() : deal.writerId?.toString();

    // Allow both the paying client and the assigned editor to access the receipt
    if (currentUserId && currentUserId.toString() !== clientUserId && currentUserId.toString() !== editorUserId) {
      return res.status(403).json({ error: 'forbidden', message: 'You are not authorized to view this receipt.' });
    }

    const clientObj = deal.userId || {};
    const editorObj = deal.writerId || {};
    const dealShortId = deal._id ? deal._id.toString().slice(-6).toUpperCase() : '000000';
    const paidDate = deal.paidAt || deal.createdAt || new Date();

    const dateFormatted = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(paidDate));

    return res.json({
      success: true,
      receipt: {
        receiptNumber: `RCPT-${dealShortId}-${new Date(paidDate).getFullYear()}`,
        dealId: deal._id,
        dealShortId,
        amount: deal.totalPrice,
        currency: 'INR',
        paymentStatus: deal.paymentStatus,
        paymentId: deal.razorpayPaymentId || 'pay_demo_verified',
        orderId: deal.razorpayOrderId || 'order_demo',
        paidAt: dateFormatted,
        rawPaidAt: paidDate,
        client: {
          name: clientObj.name || 'Client',
          email: clientObj.email || ''
        },
        editor: {
          name: editorObj.name || 'Freelance Editor',
          email: editorObj.email || ''
        },
        pages: deal.pages,
        ratePerPage: deal.pages && deal.totalPrice ? Math.round(deal.totalPrice / deal.pages) : 0,
        gateway: 'Razorpay',
        signatureVerified: Boolean(deal.razorpayPaymentId)
      }
    });
  } catch (err) {
    console.error('Error fetching receipt:', err.message);
    return res.status(500).json({ error: 'server_error', message: 'Could not load receipt.' });
  }
});

export default router;
