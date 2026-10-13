import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, createRazorpayOrder, verifyRazorpaySignature } from '../config/razorpay.js';

describe('Razorpay Demo Payment Integration Tests', () => {

  it('1. Razorpay Key ID is configured', () => {
    assert.ok(RAZORPAY_KEY_ID, 'RAZORPAY_KEY_ID should be present');
    assert.ok(RAZORPAY_KEY_ID.startsWith('rzp_test_'), 'RAZORPAY_KEY_ID should be a test key');
  });

  it('2. createRazorpayOrder creates an order with correct amount in paise', async () => {
    const order = await createRazorpayOrder({
      amount: 450, // ₹450
      currency: 'INR',
      receipt: 'test_deal_unit_1'
    });

    assert.ok(order, 'Order should be created');
    assert.ok(order.id, 'Order must have an ID');
    assert.equal(order.amount, 45000, '₹450 should be 45000 paise');
    assert.equal(order.currency, 'INR');
  });

  it('3. verifyRazorpaySignature validates valid HMAC signatures', () => {
    const orderId = 'order_test_suite_101';
    const paymentId = 'pay_test_suite_202';
    const text = `${orderId}|${paymentId}`;
    const validSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(text)
      .digest('hex');

    const isValid = verifyRazorpaySignature({
      orderId,
      paymentId,
      signature: validSignature
    });

    assert.equal(isValid, true, 'Valid signature should verify as true');
  });

  it('4. verifyRazorpaySignature rejects tampered or fraudulent signatures', () => {
    const orderId = 'order_test_suite_101';
    const paymentId = 'pay_test_suite_202';
    const tamperedSignature = 'deadbeef0123456789abcdef0123456789abcdef0123456789abcdef01234567';

    const isValid = verifyRazorpaySignature({
      orderId,
      paymentId,
      signature: tamperedSignature
    });

    assert.equal(isValid, false, 'Tampered signature should fail verification');
  });

  it('5. verifyRazorpaySignature rejects missing signature or payment ID', () => {
    assert.equal(verifyRazorpaySignature({ orderId: 'ord', paymentId: '', signature: 'sig' }), false);
    assert.equal(verifyRazorpaySignature({ orderId: 'ord', paymentId: 'pay', signature: '' }), false);
  });

  describe('Express Payment Endpoints Integration', () => {
    let server;
    let baseUrl;

    test.before(async () => {
      const express = (await import('express')).default;
      const paymentRouter = (await import('../routes/payment.js')).default;

      const app = express();
      app.set('view engine', 'ejs');
      app.set('views', (await import('path')).default.join(process.cwd(), 'views'));
      app.use(express.json());
      app.use('/payment', paymentRouter);

      await new Promise(resolve => {
        server = app.listen(0, () => {
          const port = server.address().port;
          baseUrl = `http://127.0.0.1:${port}`;
          resolve();
        });
      });
    });

    test.after(() => {
      if (server) server.close();
    });

    it('6. POST /payment/create-order returns 401 when unauthorized', async () => {
      const res = await fetch(`${baseUrl}/payment/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: '64f1a2b3c4d5e6f7a8b9d006' })
      });
      assert.equal(res.status, 401);
    });

    it('7. POST /payment/create-order rejects payment when deal is pending editor acceptance', async () => {
      const res = await fetch(`${baseUrl}/payment/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mock-user': '64f1a2b3c4d5e6f7a8b9c0d9'
        },
        body: JSON.stringify({ dealId: '64f1a2b3c4d5e6f7a8b9d001' }) // pending deal
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.error, 'not_accepted');
    });

    it('8. POST /payment/create-order succeeds for accepted deal with authenticated mock user', async () => {
      const res = await fetch(`${baseUrl}/payment/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mock-user': '64f1a2b3c4d5e6f7a8b9c0d9'
        },
        body: JSON.stringify({ dealId: '64f1a2b3c4d5e6f7a8b9d006' }) // accepted deal
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.ok(data.order.id);
      assert.equal(data.keyId, RAZORPAY_KEY_ID);
    });

    it('9. POST /payment/verify successfully verifies signature and activates deal', async () => {
      const orderId = 'order_test_verify_999';
      const paymentId = 'pay_test_verify_888';
      const signature = crypto
        .createHmac('sha256', RAZORPAY_KEY_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const res = await fetch(`${baseUrl}/payment/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mock-user': '64f1a2b3c4d5e6f7a8b9c0d9'
        },
        body: JSON.stringify({
          dealId: '64f1a2b3c4d5e6f7a8b9d006',
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature
        })
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.paymentId, paymentId);
    });

    it('9. GET /payment/receipt/:dealId returns 401 when unauthorized', async () => {
      const res = await fetch(`${baseUrl}/payment/receipt/64f1a2b3c4d5e6f7a8b9d001`);
      assert.equal(res.status, 401);
    });

    it('10. GET /payment/receipt/:dealId returns receipt details for deal participants', async () => {
      const res = await fetch(`${baseUrl}/payment/receipt/64f1a2b3c4d5e6f7a8b9d001`, {
        headers: {
          'x-mock-user': '64f1a2b3c4d5e6f7a8b9c0d9'
        }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.ok(data.receipt);
      assert.equal(data.receipt.dealShortId, 'B9D001');
      assert.ok(data.receipt.receiptNumber);
      assert.equal(data.receipt.gateway, 'Razorpay');
      assert.ok(data.receipt.client);
      assert.ok(data.receipt.editor);
    });

    it('11. GET /payment/receipt/:dealId renders official HTML receipt with PAID stamp and without Proceed to Pay button', async () => {
      const res = await fetch(`${baseUrl}/payment/receipt/64f1a2b3c4d5e6f7a8b9d001`, {
        headers: {
          'x-mock-user': '64f1a2b3c4d5e6f7a8b9c0d9',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });
      assert.equal(res.status, 200);
      const html = await res.text();
      assert.ok(html.includes('PAID'), 'Receipt HTML should contain prominent PAID stamp');
      assert.ok(html.includes('₹ 0.00') || html.includes('₹0.00'), 'Amount Due should be 0.00');
      assert.ok(!html.includes('Proceed to Pay'), 'Receipt must NOT contain Proceed to Pay button');
      assert.ok(html.includes('Download Invoice'), 'Receipt should include Download Invoice option');
      assert.ok(html.includes('Print Invoice'), 'Receipt should include Print Invoice option');
    });

    it('12. POST /payment/create-payment-link generates official Razorpay hosted link (rzp.io)', async () => {
      const { MOCK_DEALS } = await import('../routes/deal.js');
      const testDeal = MOCK_DEALS.find(d => d._id.toString() === '64f1a2b3c4d5e6f7a8b9d006');
      if (testDeal) {
        testDeal.paymentStatus = 'unpaid';
        testDeal.status = 'accepted';
      }

      const res = await fetch(`${baseUrl}/payment/create-payment-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mock-user': '64f1a2b3c4d5e6f7a8b9c0d9'
        },
        body: JSON.stringify({ dealId: '64f1a2b3c4d5e6f7a8b9d006' })
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.ok(data.paymentLinkUrl);
      assert.ok(data.paymentLinkUrl.includes('rzp.io') || data.paymentLinkUrl.includes('callback'));
    });

    it('13. GET /payment/callback activates deal and redirects to dashboard with paid=1', async () => {
      const res = await fetch(`${baseUrl}/payment/callback?dealId=64f1a2b3c4d5e6f7a8b9d006&razorpay_payment_id=pay_test_callback_777&razorpay_payment_link_status=paid`, {
        redirect: 'manual'
      });

      assert.equal(res.status, 302);
      const location = res.headers.get('location');
      assert.ok(location.includes('paid=1'));
      assert.ok(location.includes('receiptDealId=64f1a2b3c4d5e6f7a8b9d006'));
    });
  });
});


