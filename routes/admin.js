import express from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import Deal from '../models/deal.js';
import { ensureAdmin } from '../middleware/ensureAdmin.js';
import { refundRazorpayPayment } from '../config/razorpay.js';
import { createNotification } from '../utils/notifications.js';

const router = express.Router();

// Apply strict administrative guard to all /admin routes
router.use(ensureAdmin);

/**
 * GET /admin
 * Operations Backoffice Dashboard (Deals & Escrow, Editor Vetting, Payouts Ledger)
 */
router.get('/', async (req, res) => {
  try {
    const activeTab = req.query.tab || 'deals';
    const statusFilter = req.query.status || 'all';
    const searchQuery = (req.query.q || '').trim();

    const isDbConnected = mongoose.connection.readyState === 1;

    let deals = [];
    let editors = [];
    let stats = {
      totalDeals: 0,
      totalVolume: 0,
      platformRevenue: 0,
      completedDeals: 0,
      totalEditors: 0,
      pendingPayoutsCount: 0,
      pendingPayoutsAmount: 0
    };

    if (isDbConnected) {
      // 1. Fetch All Deals
      let dealFilter = {};
      if (statusFilter !== 'all') {
        if (statusFilter === 'paid') {
          dealFilter.paymentStatus = 'paid';
        } else if (statusFilter === 'unpaid') {
          dealFilter.paymentStatus = 'unpaid';
        } else {
          dealFilter.status = statusFilter;
        }
      }

      deals = await Deal.find(dealFilter)
        .populate('userId', 'name email isSuspended')
        .populate('writerId', 'name email pricePerPage isVerified isSuspended')
        .sort({ createdAt: -1 })
        .lean();

      // Filter by search query if provided
      if (searchQuery) {
        const qLower = searchQuery.toLowerCase();
        deals = deals.filter(d => 
          (d._id && d._id.toString().includes(qLower)) ||
          (d.userId?.name && d.userId.name.toLowerCase().includes(qLower)) ||
          (d.userId?.email && d.userId.email.toLowerCase().includes(qLower)) ||
          (d.writerId?.name && d.writerId.name.toLowerCase().includes(qLower)) ||
          (d.writerId?.email && d.writerId.email.toLowerCase().includes(qLower)) ||
          (d.razorpayPaymentId && d.razorpayPaymentId.toLowerCase().includes(qLower))
        );
      }

      // 2. Fetch All Editors (Writers)
      let editorFilter = { role: 'writer' };
      if (searchQuery && activeTab === 'editors') {
        editorFilter.$or = [
          { name: { $regex: searchQuery, $options: 'i' } },
          { email: { $regex: searchQuery, $options: 'i' } }
        ];
      }

      editors = await User.find(editorFilter).sort({ createdAt: -1 }).lean();

      // Count completed deals for each editor
      const allDeals = await Deal.find({}).select('writerId status paymentStatus totalPrice payoutStatus').lean();
      
      const editorCompletedCounts = {};
      const editorEarningsMap = {};

      allDeals.forEach(d => {
        if (!d.writerId) return;
        const wId = d.writerId.toString();
        if (d.status === 'completed' || d.paymentStatus === 'paid') {
          editorCompletedCounts[wId] = (editorCompletedCounts[wId] || 0) + 1;
        }
        if (d.paymentStatus === 'paid' && d.status !== 'refunded') {
          editorEarningsMap[wId] = (editorEarningsMap[wId] || 0) + (d.totalPrice * 0.85);
        }
      });

      editors = editors.map(e => ({
        ...e,
        completedCount: editorCompletedCounts[e._id.toString()] || 0,
        estimatedEarnings: Math.round(editorEarningsMap[e._id.toString()] || 0)
      }));

      // 3. Compute High-Level Metrics
      stats.totalDeals = allDeals.length;
      stats.totalEditors = editors.length;

      allDeals.forEach(d => {
        if (d.paymentStatus === 'paid' && d.status !== 'refunded') {
          stats.totalVolume += Number(d.totalPrice || 0);
          stats.platformRevenue += Number(d.totalPrice || 0) * 0.15; // 15% platform commission
        }
        if (d.status === 'completed') {
          stats.completedDeals += 1;
          if (d.payoutStatus !== 'paid_out') {
            stats.pendingPayoutsCount += 1;
            stats.pendingPayoutsAmount += Number(d.totalPrice || 0) * 0.85; // 85% to editor
          }
        }
      });
    }

    // Payouts list: deals that have been paid and are completed/in-progress
    const payoutDeals = deals.filter(d => d.paymentStatus === 'paid' && d.status !== 'refunded');

    res.render('admin', {
      pageTitle: 'Operations Backoffice — PerPage Admin',
      activeTab,
      statusFilter,
      searchQuery,
      deals,
      editors,
      payoutDeals,
      stats,
      adminUser: req.user,
      successMessage: req.query.success ? getSuccessMessage(req.query.success) : null,
      errorMessage: req.query.error ? getErrorMessage(req.query.error) : null
    });
  } catch (err) {
    console.error('❌ Admin Dashboard Error:', err);
    res.status(500).render('dealError', {
      pageTitle: 'Backoffice Error — PerPage',
      errorTitle: 'System Error',
      errorMessage: 'Could not load administrative backoffice. ' + err.message
    });
  }
});

/**
 * POST /admin/deals/:dealId/refund
 * Action: Cancel deal and issue full refund via Razorpay
 */
router.post('/deals/:dealId/refund', async (req, res) => {
  try {
    const { dealId } = req.params;
    const { refundReason } = req.body;

    const deal = await Deal.findById(dealId).populate('userId').populate('writerId');
    if (!deal) {
      return res.redirect('/admin?tab=deals&error=deal_not_found');
    }

    let refundResult = null;
    if (deal.razorpayPaymentId) {
      refundResult = await refundRazorpayPayment({
        paymentId: deal.razorpayPaymentId,
        amount: deal.totalPrice,
        notes: {
          dealId: deal._id.toString(),
          reason: refundReason || 'Admin Discretionary Refund'
        }
      });
    }

    deal.status = 'refunded';
    deal.paymentStatus = 'refunded';
    deal.refundId = refundResult?.id || `rfnd_${Date.now()}`;
    deal.refundedAt = new Date();
    await deal.save();

    // Notify Client
    if (deal.userId) {
      await createNotification({
        recipient: deal.userId._id || deal.userId,
        dealId: deal._id,
        type: 'deal_refunded',
        title: 'Order Refunded by Administration',
        message: `Your payment of ₹${deal.totalPrice || 0} for Deal #${deal._id.toString().slice(-6).toUpperCase()} has been refunded (${refundReason || 'administrative cancellation'}). Funds will credit back to your original payment method.`,
        link: `/dashboard?view=orders`
      }).catch(() => {});
    }

    // Notify Editor
    if (deal.writerId) {
      await createNotification({
        recipient: deal.writerId._id || deal.writerId,
        dealId: deal._id,
        type: 'deal_cancelled',
        title: 'Order Cancelled & Refunded',
        message: `Deal #${deal._id.toString().slice(-6).toUpperCase()} was cancelled and refunded by administration (${refundReason || 'dispute resolution'}).`,
        link: `/dashboard?view=incoming`
      }).catch(() => {});
    }

    return res.redirect('/admin?tab=deals&success=refunded');
  } catch (err) {
    console.error('❌ Admin Refund Error:', err);
    return res.redirect('/admin?tab=deals&error=refund_failed');
  }
});

/**
 * POST /admin/deals/:dealId/force-complete
 * Action: Force complete an order
 */
router.post('/deals/:dealId/force-complete', async (req, res) => {
  try {
    const { dealId } = req.params;
    const deal = await Deal.findById(dealId).populate('writerId');
    if (!deal) {
      return res.redirect('/admin?tab=deals&error=deal_not_found');
    }

    deal.status = 'completed';
    deal.completedAt = new Date();
    await deal.save();

    // Increment editor reviews / metrics if not already counted
    if (deal.writerId) {
      await User.findByIdAndUpdate(deal.writerId._id || deal.writerId, {
        $inc: { reviewCount: 1 }
      }).catch(() => {});
    }

    return res.redirect('/admin?tab=deals&success=completed');
  } catch (err) {
    console.error('❌ Admin Force Complete Error:', err);
    return res.redirect('/admin?tab=deals&error=action_failed');
  }
});

/**
 * POST /admin/deals/:dealId/mark-paid
 * Action: Manually mark an unpaid deal as Paid (for offline/cash/direct settlements)
 */
router.post('/deals/:dealId/mark-paid', async (req, res) => {
  try {
    const { dealId } = req.params;
    const deal = await Deal.findById(dealId);
    if (!deal) {
      return res.redirect('/admin?tab=deals&error=deal_not_found');
    }

    deal.paymentStatus = 'paid';
    deal.razorpayPaymentId = deal.razorpayPaymentId || `pay_manual_${Date.now()}`;
    deal.paidAt = new Date();
    if (deal.status === 'pending' || deal.status === 'accepted') {
      deal.status = 'in-progress';
    }
    await deal.save();

    return res.redirect('/admin?tab=deals&success=paid_marked');
  } catch (err) {
    console.error('❌ Admin Mark Paid Error:', err);
    return res.redirect('/admin?tab=deals&error=action_failed');
  }
});

/**
 * POST /admin/deals/:dealId/cancel
 * Action: Cancel an unpaid or abandoned deal
 */
router.post('/deals/:dealId/cancel', async (req, res) => {
  try {
    const { dealId } = req.params;
    const deal = await Deal.findById(dealId);
    if (!deal) {
      return res.redirect('/admin?tab=deals&error=deal_not_found');
    }

    deal.status = 'cancelled';
    await deal.save();

    return res.redirect('/admin?tab=deals&success=deal_cancelled');
  } catch (err) {
    console.error('❌ Admin Cancel Deal Error:', err);
    return res.redirect('/admin?tab=deals&error=action_failed');
  }
});

/**
 * POST /admin/editors/:editorId/toggle-verify
 * Action: Toggle editor verified badge
 */
router.post('/editors/:editorId/toggle-verify', async (req, res) => {
  try {
    const { editorId } = req.params;
    const editor = await User.findById(editorId);
    if (!editor || editor.role !== 'writer') {
      return res.redirect('/admin?tab=editors&error=editor_not_found');
    }

    editor.isVerified = !editor.isVerified;
    await editor.save();

    return res.redirect('/admin?tab=editors&success=verified_updated');
  } catch (err) {
    console.error('❌ Admin Toggle Verify Error:', err);
    return res.redirect('/admin?tab=editors&error=action_failed');
  }
});

/**
 * POST /admin/editors/:editorId/toggle-suspend
 * Action: Toggle editor account suspension
 */
router.post('/editors/:editorId/toggle-suspend', async (req, res) => {
  try {
    const { editorId } = req.params;
    const editor = await User.findById(editorId);
    if (!editor) {
      return res.redirect('/admin?tab=editors&error=editor_not_found');
    }

    // Safety: Cannot suspend the primary admin
    if (editor.email?.toLowerCase() === 'adityatanajinikam@gmail.com') {
      return res.redirect('/admin?tab=editors&error=cannot_suspend_admin');
    }

    editor.isSuspended = !editor.isSuspended;
    await editor.save();

    return res.redirect('/admin?tab=editors&success=suspended_updated');
  } catch (err) {
    console.error('❌ Admin Toggle Suspend Error:', err);
    return res.redirect('/admin?tab=editors&error=action_failed');
  }
});

/**
 * POST /admin/payouts/:dealId/mark-paid
 * Action: Mark editor payout as transferred
 */
router.post('/payouts/:dealId/mark-paid', async (req, res) => {
  try {
    const { dealId } = req.params;
    const deal = await Deal.findById(dealId).populate('writerId');
    if (!deal) {
      return res.redirect('/admin?tab=payouts&error=deal_not_found');
    }

    deal.payoutStatus = 'paid_out';
    deal.payoutPaidAt = new Date();
    await deal.save();

    const editorPayout = Math.round(deal.totalPrice * 0.85);

    // Notify Editor
    if (deal.writerId) {
      await createNotification({
        recipient: deal.writerId._id || deal.writerId,
        dealId: deal._id,
        type: 'payout_transferred',
        title: 'Payout Transferred',
        message: `Your earnings of ₹${editorPayout} (85% of Deal #${deal._id.toString().slice(-6).toUpperCase()}) have been marked as transferred to your payout account.`,
        link: `/dashboard?view=incoming`
      }).catch(() => {});
    }

    return res.redirect('/admin?tab=payouts&success=payout_marked');
  } catch (err) {
    console.error('❌ Admin Mark Payout Error:', err);
    return res.redirect('/admin?tab=payouts&error=action_failed');
  }
});

function getSuccessMessage(code) {
  const map = {
    refunded: 'Deal successfully refunded via Razorpay and status marked as Refunded.',
    completed: 'Deal was successfully force-completed by administration.',
    verified_updated: 'Editor verification badge updated successfully.',
    suspended_updated: 'Account status (active/suspended) updated successfully.',
    payout_marked: 'Payout status marked as Settled / Paid Out.',
    paid_marked: 'Deal payment marked as collected (Paid into Escrow).',
    deal_cancelled: 'Deal was cancelled.'
  };
  return map[code] || 'Operation completed successfully.';
}

function getErrorMessage(code) {
  const map = {
    deal_not_found: 'The requested deal could not be located.',
    editor_not_found: 'The requested editor could not be located.',
    cannot_suspend_admin: 'Primary platform administrator cannot be suspended.',
    refund_failed: 'Could not process refund through Razorpay. Check logs.',
    action_failed: 'Action could not be completed.'
  };
  return map[code] || 'An error occurred while executing administrative action.';
}

export default router;
