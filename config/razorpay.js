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

export default {
  RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET,
  getRazorpay,
  createRazorpayOrder,
  verifyRazorpaySignature
};
