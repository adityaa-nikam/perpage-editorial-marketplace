import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Configure Nodemailer Transport
 * Supports:
 * 1. Gmail SMTP (via EMAIL_USER & EMAIL_PASS / App Password)
 * 2. Generic SMTP (via SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)
 * 3. Fallback: ethereal or simulated logging when credentials are not yet configured
 */
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD;

  if (emailUser && emailPass) {
    transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: emailUser,
        pass: emailPass
      }
    });
    return transporter;
  }

  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
    return transporter;
  }

  return null;
}

/**
 * Generates high-fidelity HTML email receipt matching Razorpay's official layout
 */
function generateReceiptHtml({ receiptData, client, editor, deal }) {
  const shortId = receiptData.dealShortId;
  const amount = receiptData.amount;
  const paymentId = receiptData.paymentId;
  const orderId = receiptData.orderId;
  const paidAt = receiptData.paidAt;
  const pages = deal?.pages || '—';
  const siteUrl = (process.env.SITE_URL || 'https://perpage-app.onrender.com').replace(/\/+$/, '');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Receipt — PerPage</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 20px; -webkit-font-smoothing: antialiased; }
    .card { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 18px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
    .header { background: #2563eb; color: #ffffff; padding: 28px 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }
    .badge { display: inline-block; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; margin-top: 8px; }
    .amount-box { text-align: center; padding: 24px 20px 10px; }
    .amount-box .amount { font-size: 36px; font-weight: 800; color: #0f172a; margin: 0; }
    .amount-box .status { color: #16a34a; font-size: 14px; font-weight: 600; margin-top: 4px; display: inline-flex; align-items: center; }
    .details { padding: 10px 24px 20px; }
    .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
    .row .label { color: #64748b; font-weight: 500; }
    .row .value { color: #0f172a; font-weight: 600; text-align: right; word-break: break-all; }
    .note-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; margin: 15px 24px; font-size: 13px; color: #475569; line-height: 1.5; }
    .cta { text-align: center; padding: 10px 24px 28px; }
    .btn { display: inline-block; background: #2563eb; color: #ffffff !important; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; }
    .footer { text-align: center; padding: 18px 20px; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>PerPage Payment Receipt</h1>
      <div class="badge">Receipt #${receiptData.receiptNumber}</div>
    </div>
    
    <div class="amount-box">
      <div class="amount">₹${Number(amount).toFixed(2)}</div>
      <div class="status">✓ Paid Successfully via Razorpay</div>
    </div>

    <div class="details">
      <table style="width: 100%; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 0; color: #64748b; font-size: 13px;">Payment ID</td>
          <td style="padding: 10px 0; color: #0f172a; font-weight: 600; font-size: 13px; text-align: right; font-family: monospace;">${paymentId}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 0; color: #64748b; font-size: 13px;">Order ID</td>
          <td style="padding: 10px 0; color: #0f172a; font-weight: 600; font-size: 13px; text-align: right; font-family: monospace;">${orderId}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 0; color: #64748b; font-size: 13px;">Date & Time</td>
          <td style="padding: 10px 0; color: #0f172a; font-weight: 600; font-size: 13px; text-align: right;">${paidAt}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 0; color: #64748b; font-size: 13px;">Deal Reference</td>
          <td style="padding: 10px 0; color: #0f172a; font-weight: 600; font-size: 13px; text-align: right;">DEAL #${shortId}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 0; color: #64748b; font-size: 13px;">Assigned Editor</td>
          <td style="padding: 10px 0; color: #0f172a; font-weight: 600; font-size: 13px; text-align: right;">${editor?.name || 'Freelance Editor'}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 0; color: #64748b; font-size: 13px;">Pages Count</td>
          <td style="padding: 10px 0; color: #0f172a; font-weight: 600; font-size: 13px; text-align: right;">${pages} pages</td>
        </tr>
      </table>
    </div>

    <div class="note-box">
      <strong>Milestone Escrow Notice:</strong> Your payment is held safely in escrow. Your editor has been notified and is currently reviewing your document. Once they deliver the edited draft, you will be able to review and confirm completion.
    </div>

    <div class="cta">
      <a href="${siteUrl}/dashboard?view=orders" class="btn">View Deal on PerPage Dashboard →</a>
    </div>

    <div class="footer">
      Secured by Razorpay • PerPage Editorial & Academic Review Platform<br>
      For questions regarding this receipt, contact support at ${process.env.EMAIL_USER || 'support@perpage.edu'}
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Sends official payment receipt email via Nodemailer
 */
export async function sendRazorpayReceiptEmail({ client, editor, deal, paymentId, orderId, paidAt = new Date() }) {
  const receiptNumber = `RCPT-${deal._id ? deal._id.toString().slice(-6).toUpperCase() : '000000'}-${Date.now().toString().slice(-4)}`;
  const dateFormatted = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(paidAt);

  const receiptData = {
    receiptNumber,
    dealId: deal._id ? deal._id.toString() : '',
    dealShortId: deal._id ? deal._id.toString().slice(-6).toUpperCase() : '000000',
    amount: deal.totalPrice || 0,
    currency: 'INR',
    paymentId: paymentId || deal.razorpayPaymentId || 'pay_demo',
    orderId: orderId || deal.razorpayOrderId || 'order_demo',
    paidAt: dateFormatted,
    client: {
      name: client?.name || 'Client',
      email: client?.email || ''
    },
    editor: {
      name: editor?.name || 'Editor',
      email: editor?.email || ''
    },
    platform: 'PerPage Academic Help Platform',
    gateway: 'Razorpay'
  };

  console.log(`\n============================================================`);
  console.log(`🧾 [RAZORPAY RECEIPT DISPATCH] ${receiptNumber}`);
  console.log(`------------------------------------------------------------`);
  console.log(`To (Payer):       ${receiptData.client.name} <${receiptData.client.email}>`);
  console.log(`Amount:           ₹${receiptData.amount} (INR)`);
  console.log(`Payment ID:       ${receiptData.paymentId}`);
  console.log(`Order ID:         ${receiptData.orderId}`);
  console.log(`Date:             ${receiptData.paidAt}`);
  console.log(`Status:           CAPTURED / SUCCESSFUL`);
  console.log(`Gateway:          Secured by Razorpay`);
  console.log(`============================================================\n`);

  // Attempt real email dispatch via Nodemailer if client email is present
  const clientEmail = receiptData.client.email;
  const mailTransporter = getTransporter();

  if (mailTransporter && clientEmail) {
    try {
      const htmlContent = generateReceiptHtml({ receiptData, client, editor, deal });
      const info = await mailTransporter.sendMail({
        from: `"PerPage Payment Gateway" <${process.env.EMAIL_USER || 'no-reply@perpage.edu'}>`,
        to: clientEmail,
        cc: editor?.email && editor.email !== clientEmail ? editor.email : undefined,
        subject: `Payment receipt for your successful transaction on PerPage (ID: ${receiptData.paymentId})`,
        text: `Thank you for your payment of ₹${receiptData.amount} for Deal #${receiptData.dealShortId}. Payment ID: ${receiptData.paymentId}. View your dashboard: ${process.env.SITE_URL || 'https://perpage-app.onrender.com'}/dashboard`,
        html: htmlContent
      });
      console.log(`✅ [Nodemailer] Official Receipt Email delivered to ${clientEmail} (Message ID: ${info.messageId})`);
    } catch (mailErr) {
      console.warn(`⚠️ [Nodemailer] Could not send receipt email to ${clientEmail}:`, mailErr.message);
    }
  } else if (!mailTransporter && clientEmail) {
    console.log(`ℹ️ [Nodemailer] Set EMAIL_USER & EMAIL_PASS in .env / Render to automatically dispatch live receipt emails to ${clientEmail}`);
  }

  return {
    success: true,
    receiptNumber,
    receiptData
  };
}

export default {
  sendRazorpayReceiptEmail
};
