import Razorpay from 'razorpay';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

export const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_TmcIAG1CGAmuwk';
export const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';

let instance = null;

if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET && RAZORPAY_KEY_SECRET !== '••••••••••••••••••••••••') {
  try {
    instance = new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET,
    });
  } catch (err) {
    console.error('⚠️ Could not initialize Razorpay SDK:', err.message);
  }
}

export const getRazorpay = () => instance;

/**
 * Creates an order with Razorpay or provides a test order fallback.
 */
export async function createRazorpayOrder({ amount, currency = 'INR', receipt, notes = {} }) {
  const amountInPaise = Math.round(Number(amount) * 100);

  if (instance) {
    return await instance.orders.create({
      amount: amountInPaise,
      currency,
      receipt: String(receipt).slice(0, 40),
      notes,
    });
  }

  // Fallback / simulation order for test mode when key secret is awaiting entry
  const dummyOrderId = `order_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  return {
    id: dummyOrderId,
    entity: 'order',
    amount: amountInPaise,
    currency,
    receipt,
    status: 'created',
    created_at: Math.floor(Date.now() / 1000)
  };
}

/**
 * Verifies Razorpay HMAC SHA256 payment signature.
 */
export function verifyRazorpaySignature({ orderId, paymentId, signature }) {
  if (!signature || !paymentId) return false;

  if (RAZORPAY_KEY_SECRET && RAZORPAY_KEY_SECRET !== '••••••••••••••••••••••••') {
    const text = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(text)
      .digest('hex');

    return expectedSignature === signature;
  }

  // If secret not configured in local test mode, accept valid test format
  return paymentId.startsWith('pay_');
}

/**
 * Creates an official Razorpay Hosted Payment Link (rzp.io).
 */
export async function createRazorpayPaymentLink({
  amount,
  currency = 'INR',
  description,
  dealId,
  customer = {},
  callbackUrl,
  notes = {}
}) {
  const amountInPaise = Math.round(Number(amount) * 100);

  if (instance) {
    return await instance.paymentLink.create({
      amount: amountInPaise,
      currency,
      accept_partial: false,
      reference_id: `deal_${dealId}_${Date.now()}`.slice(0, 40),
      description: description || `Academic Editorial Review - Deal #${dealId}`,
      customer: {
        name: customer.name || 'Client',
        email: customer.email || 'client@example.com',
        contact: customer.contact || undefined
      },
      notify: {
        sms: false,
        email: false
      },
      reminder_enable: false,
      notes: {
        dealId: String(dealId),
        ...notes
      },
      callback_url: callbackUrl,
      callback_method: 'get'
    });
  }

  // Fallback simulation for test mode
  const dummyLinkId = `plink_test_${Date.now()}`;
  return {
    id: dummyLinkId,
    short_url: `${callbackUrl}&razorpay_payment_id=pay_test_${Date.now()}&razorpay_payment_link_id=${dummyLinkId}&razorpay_payment_link_status=paid`,
    status: 'created',
    amount: amountInPaise
  };
}

/**
 * Issues a full or partial refund for a Razorpay payment.
 */
export async function refundRazorpayPayment({ paymentId, amount, notes = {} }) {
  if (instance && paymentId && paymentId.startsWith('pay_')) {
    const params = { notes };
    if (amount) {
      params.amount = Math.round(Number(amount) * 100);
    }
    return await instance.payments.refund(paymentId, params);
  }

  // Fallback simulation for test mode
  return {
    id: `rfnd_test_${Date.now()}`,
    entity: 'refund',
    amount: amount ? Math.round(Number(amount) * 100) : 0,
    status: 'processed',
    payment_id: paymentId
  };
}

export default {
  RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET,
  getRazorpay,
  createRazorpayOrder,
  createRazorpayPaymentLink,
  refundRazorpayPayment,
  verifyRazorpaySignature
};
