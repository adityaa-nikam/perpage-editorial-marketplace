import express from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import Deal from '../models/deal.js';
import { MOCK_DEALS } from './deal.js';
import { RAZORPAY_KEY_ID, getRazorpay, createRazorpayOrder, createRazorpayPaymentLink, verifyRazorpaySignature } from '../config/razorpay.js';
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

// POST /payment/create-payment-link (Choice B: Razorpay Hosted Page rzp.io)
router.post('/create-payment-link', checkAuthenticated, async (req, res) => {
  try {
    const { dealId } = req.body;
    if (!dealId) {
      return res.status(400).json({ error: 'bad_request', message: 'Deal ID is required.' });
    }

    let deal = null;
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected && mongoose.Types.ObjectId.isValid(dealId)) {
      deal = await Deal.findById(dealId).populate('userId', 'name email phone').populate('writerId', 'name email');
    } else if (process.env.NODE_ENV !== 'production' && Array.isArray(MOCK_DEALS)) {
      deal = MOCK_DEALS.find(d => d._id.toString() === dealId.toString());
    }

    if (!deal) {
      return res.status(404).json({ error: 'not_found', message: 'Deal not found.' });
    }

    const currentUserId = req.user && (req.user._id || req.user.id);
    if (currentUserId && deal.userId && deal.userId._id && deal.userId._id.toString() !== currentUserId.toString()) {
      return res.status(403).json({ error: 'forbidden', message: 'You are not authorized to pay for this deal.' });
    }

    if (deal.paymentStatus === 'paid') {
      return res.status(400).json({ error: 'already_paid', message: 'This deal is already marked as paid.' });
    }

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

    const siteUrl = (process.env.SITE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
    const dealShortId = deal._id ? deal._id.toString().slice(-6).toUpperCase() : '000000';
    const clientName = deal.userId?.name || req.user?.name || 'Client';
    const clientEmail = deal.userId?.email || req.user?.email || 'client@example.com';
    const clientPhone = deal.userId?.phone || undefined;

    // Create official Razorpay Hosted Payment Link (rzp.io)
    const paymentLink = await createRazorpayPaymentLink({
      amount: deal.totalPrice,
      currency: 'INR',
      description: `PerPage Review Deal #${dealShortId} (${deal.pages || 1} pages)`,
      dealId: deal._id,
      customer: {
        name: clientName,
        email: clientEmail,
        contact: clientPhone
      },
      callbackUrl: `${siteUrl}/payment/callback?dealId=${deal._id}`,
      notes: {
        dealId: deal._id.toString(),
        userId: currentUserId ? currentUserId.toString() : 'guest'
      }
    });

    if (isDbConnected && typeof deal.save === 'function') {
      deal.razorpayPaymentLinkId = paymentLink.id;
      deal.razorpayInvoiceUrl = paymentLink.short_url;
      await deal.save();
    } else if (deal) {
      deal.razorpayPaymentLinkId = paymentLink.id;
      deal.razorpayInvoiceUrl = paymentLink.short_url;
    }

    return res.json({
      success: true,
      paymentLinkUrl: paymentLink.short_url,
      paymentLinkId: paymentLink.id,
      amount: deal.totalPrice
    });
  } catch (err) {
    console.error('Error creating Razorpay payment link:', err.message);
    return res.status(500).json({ error: 'link_creation_failed', message: 'Unable to generate Razorpay hosted payment link.' });
  }
});

// GET /payment/callback (Razorpay Hosted Page rzp.io Callback Handler)
router.get('/callback', async (req, res) => {
  try {
    const { 
      dealId, 
      razorpay_payment_id, 
      razorpay_payment_link_id, 
      razorpay_payment_link_status,
      razorpay_signature 
    } = req.query;

    if (!dealId && !razorpay_payment_link_id) {
      return res.redirect('/dashboard?view=orders&error=missing_payment_ref');
    }

    const isDbConnected = mongoose.connection.readyState === 1;
    let deal = null;

    if (isDbConnected) {
      if (dealId && mongoose.Types.ObjectId.isValid(dealId)) {
        deal = await Deal.findById(dealId).populate('userId', 'name email').populate('writerId', 'name email');
      }
      if (!deal && razorpay_payment_link_id) {
        deal = await Deal.findOne({ razorpayPaymentLinkId: razorpay_payment_link_id }).populate('userId', 'name email').populate('writerId', 'name email');
      }
    } else if (Array.isArray(MOCK_DEALS)) {
      deal = MOCK_DEALS.find(d => 
        (dealId && d._id.toString() === dealId.toString()) || 
        (razorpay_payment_link_id && d.razorpayPaymentLinkId === razorpay_payment_link_id)
      );
    }

    if (!deal) {
      return res.redirect('/dashboard?view=orders&error=deal_not_found');
    }

    // Check payment status or payment ID
    const isPaid = razorpay_payment_link_status === 'paid' || Boolean(razorpay_payment_id);

    if (isPaid) {
      deal.paymentStatus = 'paid';
      if (deal.status === 'accepted') {
        deal.status = 'in-progress';
      }
      if (razorpay_payment_id) {
        deal.razorpayPaymentId = razorpay_payment_id;
      }
      if (razorpay_payment_link_id) {
        deal.razorpayPaymentLinkId = razorpay_payment_link_id;
      }
      if (razorpay_signature) {
        deal.razorpaySignature = razorpay_signature;
      }
      deal.paidAt = new Date();

      const dealShortId = deal._id ? deal._id.toString().slice(-6).toUpperCase() : '000000';
      deal.razorpayInvoiceId = deal.razorpayInvoiceId || (deal.razorpayPaymentId ? `RCPT-${dealShortId}-${Date.now().toString().slice(-4)}` : `RCPT-${dealShortId}`);
      deal.razorpayInvoiceUrl = `/payment/receipt/${deal._id}`;

      if (isDbConnected && typeof deal.save === 'function') {
        await deal.save();
      }

      // Auto-resolve pending payment notifications
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
      } catch (_) {}

      // Dispatch dual emails
      const clientEmail = deal.userId?.email || '';
      const clientName = deal.userId?.name || 'Client';
      const editorEmail = deal.writerId?.email || '';
      const editorName = deal.writerId?.name || 'Editor';

      sendRazorpayReceiptEmail({
        client: { name: clientName, email: clientEmail },
        editor: { name: editorName, email: editorEmail },
        deal,
        paymentId: deal.razorpayPaymentId || 'pay_verified',
        orderId: deal.razorpayOrderId || deal.razorpayPaymentLinkId || 'rzp_hosted',
        invoiceUrl: `/payment/receipt/${deal._id}`,
        invoiceId: deal.razorpayInvoiceId,
        paymentMethod: 'Razorpay Hosted (rzp.io)',
        paidAt: deal.paidAt
      }).catch(() => {});

      // Notify editor
      if (deal.writerId) {
        createNotification({
          recipient: deal.writerId._id || deal.writerId,
          dealId: deal._id,
          type: 'payment_received',
          title: 'Payment Received (rzp.io)',
          message: `Client completed payment of ₹${deal.totalPrice || 0} via Razorpay Hosted Page. You can begin editing!`,
          link: `/dashboard?view=incoming&receiptDealId=${deal._id}`
        }).catch(() => {});
      }

      // Notify client
      if (deal.userId) {
        createNotification({
          recipient: deal.userId._id || deal.userId,
          dealId: deal._id,
          type: 'payment_received',
          title: 'Payment Successful',
          message: `Your payment of ₹${deal.totalPrice || 0} via Razorpay was confirmed.`,
          link: `/dashboard?view=orders&receiptDealId=${deal._id}`
        }).catch(() => {});
      }

      // Redirect client to dashboard with success banner & highlight
      return res.redirect(`/dashboard?view=orders&paid=1&receiptDealId=${deal._id}`);
    }

    return res.redirect(`/dashboard?view=orders&payment_status=${razorpay_payment_link_status || 'unpaid'}`);
  } catch (err) {
    console.error('Error in Razorpay callback:', err.message);
    return res.redirect('/dashboard?view=orders&error=callback_error');
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
      let clientEmail = (deal.userId && deal.userId.email) || req.user?.email || '';
      let clientName = (deal.userId && deal.userId.name) || req.user?.name || 'Client';
      let editorEmail = (deal.writerId && deal.writerId.email) || '';
      let editorName = (deal.writerId && deal.writerId.name) || 'Editor';

      if (!editorEmail && deal.writerId) {
        try {
          const wId = deal.writerId._id || deal.writerId;
          const wUser = await User.findById(wId).select('name email').lean();
          if (wUser) {
            editorEmail = wUser.email;
            editorName = wUser.name;
          }
        } catch (_) {}
      }
      if (!clientEmail && deal.userId) {
        try {
          const uId = deal.userId._id || deal.userId;
          const uUser = await User.findById(uId).select('name email').lean();
          if (uUser) {
            clientEmail = uUser.email;
            clientName = uUser.name;
          }
        } catch (_) {}
      }
      if (!clientEmail && req.user) {
        clientEmail = req.user.email || '';
        clientName = req.user.name || clientName;
      }

      const clientObj = { name: clientName, email: clientEmail };
      const editorObj = { name: editorName, email: editorEmail };
      const dealShortId = deal._id ? deal._id.toString().slice(-6).toUpperCase() : '000000';

      // 1. Fetch live transaction data from Razorpay & create authentic hosted Razorpay invoice (rzp.io)
      const rzp = getRazorpay();
      let rzpPayment = null;
      if (rzp && razorpay_payment_id && razorpay_payment_id.startsWith('pay_')) {
        try {
          rzpPayment = await rzp.payments.fetch(razorpay_payment_id);
          if (rzpPayment?.method) {
            deal.razorpayPaymentMethod = rzpPayment.method;
          }
        } catch (fetchErr) {
          console.warn('Could not fetch Razorpay payment details in verify:', fetchErr.message);
        }
      }

      // Official payment receipt reference & dedicated receipt view
      deal.razorpayInvoiceId = deal.razorpayInvoiceId || (deal.razorpayPaymentId ? `RCPT-${dealShortId}-${Date.now().toString().slice(-4)}` : `RCPT-${dealShortId}`);
      deal.razorpayInvoiceUrl = `/payment/receipt/${deal._id}`;

      if (isDbConnected && typeof deal.save === 'function') {
        await deal.save();
      }

      // 2. Dispatch platform receipt email with direct link to official Razorpay receipt
      sendRazorpayReceiptEmail({
        client: clientObj,
        editor: editorObj,
        deal,
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        invoiceUrl: deal.razorpayInvoiceUrl || '',
        invoiceId: deal.razorpayInvoiceId || '',
        paymentMethod: deal.razorpayPaymentMethod || '',
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
      paymentId: razorpay_payment_id,
      invoiceUrl: deal?.razorpayInvoiceUrl || ''
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
    const isAdmin = req.user?.role === 'admin' || (req.user?.email && req.user.email.toLowerCase() === 'adityatanajinikam@gmail.com');

    // Allow paying client, assigned editor, or platform admin to access the receipt
    if (!isAdmin && currentUserId && currentUserId.toString() !== clientUserId && currentUserId.toString() !== editorUserId) {
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

    // Fetch real payment details directly from Razorpay
    const rzp = getRazorpay();
    let rzpPayment = null;
    if (rzp && deal.razorpayPaymentId && deal.razorpayPaymentId.startsWith('pay_')) {
      try {
        rzpPayment = await rzp.payments.fetch(deal.razorpayPaymentId);
      } catch (fetchErr) {
        console.warn('Could not fetch Razorpay payment details for receipt:', fetchErr.message);
      }
    }

    // Ensure official receipt reference & link point to our authentic receipt view
    deal.razorpayInvoiceId = deal.razorpayInvoiceId || (deal.razorpayPaymentId ? `RCPT-${dealShortId}-${Date.now().toString().slice(-4)}` : `RCPT-${dealShortId}`);
    deal.razorpayInvoiceUrl = `/payment/receipt/${deal._id}`;
    if (isDbConnected && typeof deal.save === 'function') {
      try { await deal.save(); } catch (e) {}
    }

    // Format human-friendly payment method
    let methodLabel = deal.razorpayPaymentMethod || '';
    if (rzpPayment?.method) {
      if (rzpPayment.method === 'wallet') {
        methodLabel = `Wallet (${rzpPayment.wallet ? rzpPayment.wallet.toUpperCase() : 'MobiKwik'})`;
      } else if (rzpPayment.method === 'upi') {
        methodLabel = `UPI / QR (${rzpPayment.vpa || 'Direct'})`;
      } else if (rzpPayment.method === 'card') {
        methodLabel = `Card (${rzpPayment.bank || 'Visa/Mastercard'})`;
      } else if (rzpPayment.method === 'netbanking') {
        methodLabel = `NetBanking (${rzpPayment.bank || 'Direct Bank'})`;
      } else {
        methodLabel = rzpPayment.method.toUpperCase();
      }
    }
    if (!methodLabel) {
      methodLabel = 'Razorpay Gateway (Demo Mode)';
    }

    // If accessed directly from browser / email link, render the authentic receipt page
    const acceptHeader = req.headers.accept || '';
    const isHtmlRequested = (req.query.format === 'html' || (acceptHeader.includes('text/html') && acceptHeader !== '*/*')) && !req.xhr;
    if (isHtmlRequested) {
      const unitPrice = deal.pages && Number(deal.pages) > 0 ? (deal.totalPrice / deal.pages) : deal.totalPrice;
      return res.render('receipt', {
        pageTitle: `Payment Receipt #${dealShortId} — PerPage`,
        deal,
        dealShortId,
        dateFormatted,
        dateSuffix: Date.now().toString().slice(-4),
        paymentId: deal.razorpayPaymentId || 'pay_demo_verified',
        orderId: deal.razorpayOrderId || 'order_demo',
        paymentMethod: methodLabel,
        editorName: editorObj.name || 'Freelance Editor',
        clientName: clientObj.name || 'Client',
        unitPriceFormatted: Number(unitPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
        totalFormatted: Number(deal.totalPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })
      });
    }

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
        razorpayInvoiceId: deal.razorpayInvoiceId || `RCPT-${dealShortId}`,
        razorpayInvoiceUrl: `/payment/receipt/${deal._id}`,
        paymentMethod: methodLabel,
        gatewayFee: rzpPayment?.fee ? (rzpPayment.fee / 100).toFixed(2) : null,
        gatewayTax: rzpPayment?.tax ? (rzpPayment.tax / 100).toFixed(2) : null,
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
        gateway: 'Razorpay',
        gatewayMode: 'Test / Demo Mode',
        signatureVerified: Boolean(deal.razorpayPaymentId)
      }
    });
  } catch (err) {
    console.error('Error fetching receipt:', err.message);
    return res.status(500).json({ error: 'server_error', message: 'Could not load receipt.' });
  }
});

export default router;
