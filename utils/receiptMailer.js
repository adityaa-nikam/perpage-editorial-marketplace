import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Configure Nodemailer Transport
 * Supports:
 * 1. Gmail SMTP (via EMAIL_USER & EMAIL_PASS / App Password)
 * 2. Generic SMTP (via SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)
 * 3. Fallback: simulated logging when credentials are not yet configured
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
      },
      pool: true,
      maxConnections: 3,
      maxMessages: 100
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
 * Generates official Client Payment Receipt HTML
 */
function generateClientReceiptHtml({ receiptData, client, editor, deal }) {
  const shortId = receiptData.dealShortId;
  const amount = receiptData.amount;
  const paymentId = receiptData.paymentId;
  const orderId = receiptData.orderId;
  const invoiceUrl = receiptData.invoiceUrl;
  const invoiceId = receiptData.invoiceId;
  const paymentMethod = receiptData.paymentMethod || 'Razorpay Gateway';
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
          <td style="padding: 10px 0; color: #64748b; font-size: 13px;">Payment Method</td>
          <td style="padding: 10px 0; color: #0f172a; font-weight: 600; font-size: 13px; text-align: right;">${paymentMethod}</td>
        </tr>
        ${invoiceId ? `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 0; color: #64748b; font-size: 13px;">Receipt Reference</td>
          <td style="padding: 10px 0; color: #0f172a; font-weight: 600; font-size: 13px; text-align: right; font-family: monospace;">${invoiceId}</td>
        </tr>
        ` : ''}
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 0; color: #16a34a; font-size: 13px; font-weight: 600;">Balance Due</td>
          <td style="padding: 10px 0; color: #16a34a; font-weight: 700; font-size: 13px; text-align: right; font-family: monospace;">₹0.00 (Fully Settled)</td>
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

    ${invoiceUrl ? `
    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px 16px; margin: 15px 24px; text-align: center;">
      <div style="font-size: 11px; text-transform: uppercase; color: #16a34a; font-weight: 700; letter-spacing: 0.05em; margin-bottom: 4px;">Official Payment Receipt (Paid)</div>
      <p style="margin: 0 0 10px; font-size: 13px; color: #15803d;">Your payment has cleared. View the official transaction receipt with PAID stamp and download PDF:</p>
      <a href="${invoiceUrl.startsWith('http') ? invoiceUrl : (siteUrl + (invoiceUrl.startsWith('/') ? '' : '/') + invoiceUrl)}" target="_blank" style="display: inline-block; background: #16a34a; color: #ffffff !important; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: 700; font-size: 13px;">
        Open Official Payment Receipt &rarr;
      </a>
    </div>
    ` : ''}

    <div class="note-box">
      <strong>Order Balance Notice:</strong> Your payment of ₹${Number(amount).toFixed(2)} is confirmed on platform balance. Your assigned editor has been notified to begin work on your manuscript.
    </div>

    <div class="cta">
      <a href="${siteUrl}/dashboard?view=orders" class="btn">View Order on PerPage →</a>
    </div>

    <div class="footer">
      Secured by Razorpay • PerPage Editorial & Academic Marketplace<br>
      For questions, contact support at ${process.env.EMAIL_USER || 'support@perpage.edu'}
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Generates official Editor "Funds Secured / Start Review" Notification HTML
 */
function generateEditorEscrowHtml({ receiptData, client, editor, deal }) {
  const shortId = receiptData.dealShortId;
  const amount = receiptData.amount;
  const paymentId = receiptData.paymentId;
  const paidAt = receiptData.paidAt;
  const pages = deal?.pages || '—';
  const siteUrl = (process.env.SITE_URL || 'https://perpage-app.onrender.com').replace(/\/+$/, '');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Confirmed — PerPage</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 20px; -webkit-font-smoothing: antialiased; }
    .card { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 18px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
    .header { background: #047857; color: #ffffff; padding: 28px 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }
    .badge { display: inline-block; background: rgba(255,255,255,0.25); padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; margin-top: 8px; }
    .amount-box { text-align: center; padding: 24px 20px 10px; }
    .amount-box .amount { font-size: 36px; font-weight: 800; color: #047857; margin: 0; }
    .amount-box .status { color: #047857; font-size: 14px; font-weight: 600; margin-top: 4px; }
    .details { padding: 10px 24px 20px; }
    .instruction-box { background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 16px; margin: 15px 24px; font-size: 13px; color: #065f46; line-height: 1.5; }
    .cta { text-align: center; padding: 10px 24px 28px; }
    .btn { display: inline-block; background: #047857; color: #ffffff !important; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; }
    .footer { text-align: center; padding: 18px 20px; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>Payment Confirmed by Client</h1>
      <div class="badge">Deal #${shortId} • Authorized to Begin Review</div>
    </div>
    
    <div class="amount-box">
      <div class="amount">₹${Number(amount).toFixed(2)}</div>
      <div class="status">✓ Paid by Client via Razorpay</div>
    </div>

    <div class="details">
      <table style="width: 100%; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 0; color: #64748b; font-size: 13px;">Client</td>
          <td style="padding: 10px 0; color: #0f172a; font-weight: 600; font-size: 13px; text-align: right;">${client?.name || 'Client'} (${client?.email || 'N/A'})</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 0; color: #64748b; font-size: 13px;">Razorpay Payment ID</td>
          <td style="padding: 10px 0; color: #0f172a; font-weight: 600; font-size: 13px; text-align: right; font-family: monospace;">${paymentId}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 0; color: #64748b; font-size: 13px;">Payment Time</td>
          <td style="padding: 10px 0; color: #0f172a; font-weight: 600; font-size: 13px; text-align: right;">${paidAt}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 0; color: #64748b; font-size: 13px;">Manuscript Scope</td>
          <td style="padding: 10px 0; color: #0f172a; font-weight: 600; font-size: 13px; text-align: right;">${pages} pages</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 0; color: #64748b; font-size: 13px;">Status</td>
          <td style="padding: 10px 0; color: #047857; font-weight: 700; font-size: 13px; text-align: right;">Held in Platform Balance</td>
        </tr>
      </table>
    </div>

    <div class="instruction-box">
      <strong>Next Steps for You:</strong>
      <ol style="margin: 8px 0 0 18px; padding: 0;">
        <li>Download the client's manuscript from your incoming deals dashboard.</li>
        <li>Perform your review and markup per your agreement.</li>
        <li>Upload the completed final PDF draft to your dashboard.</li>
      </ol>
      <p style="margin: 8px 0 0; font-size: 12px; color: #047857;">Once the client accepts the delivery, your earnings are released.</p>
    </div>

    <div class="cta">
      <a href="${siteUrl}/dashboard?view=incoming" class="btn">Open Incoming Work Queue →</a>
    </div>

    <div class="footer">
      Secured by Razorpay • PerPage Editorial & Academic Marketplace<br>
      Official Cross-Check Receipt Ref: ${receiptData.receiptNumber}
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Sends official dual payment receipts:
 * 1. Payer Receipt to Client
 * 2. Escrow Funding Alert to Editor
 */
export async function sendRazorpayReceiptEmail({
  client,
  editor,
  deal,
  paymentId,
  orderId,
  invoiceUrl,
  invoiceId,
  paymentMethod,
  paidAt = new Date()
}) {
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
    invoiceUrl: invoiceUrl || (deal._id ? `/payment/receipt/${deal._id}` : (deal.razorpayInvoiceUrl || '')),
    invoiceId: invoiceId || deal.razorpayInvoiceId || '',
    paymentMethod: paymentMethod || deal.razorpayPaymentMethod || 'Razorpay Gateway',
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
  console.log(`🧾 [DUAL RAZORPAY RECEIPT DISPATCH] ${receiptNumber}`);
  console.log(`------------------------------------------------------------`);
  console.log(`Client (Payer):   ${receiptData.client.name} <${receiptData.client.email}>`);
  console.log(`Editor (Worker):  ${receiptData.editor.name} <${receiptData.editor.email}>`);
  console.log(`Amount:           ₹${receiptData.amount} (INR)`);
  console.log(`Payment ID:       ${receiptData.paymentId}`);
  console.log(`Order ID:         ${receiptData.orderId}`);
  console.log(`Invoice URL:      ${receiptData.invoiceUrl || 'N/A'}`);
  console.log(`Date:             ${receiptData.paidAt}`);
  console.log(`Gateway:          Processed via Razorpay`);
  console.log(`============================================================\n`);

  const clientEmail = receiptData.client.email;
  const editorEmail = receiptData.editor.email;
  const mailTransporter = getTransporter();

  if (mailTransporter) {
    const dispatchJobs = [];

    // 1. Dispatch official Payer Receipt to Client
    if (clientEmail) {
      const clientHtml = generateClientReceiptHtml({ receiptData, client, editor, deal });
      dispatchJobs.push(
        mailTransporter.sendMail({
          from: `"PerPage Payment Gateway" <${process.env.EMAIL_USER || 'no-reply@perpage.edu'}>`,
          to: clientEmail,
          subject: `Payment receipt for your successful transaction on PerPage (ID: ${receiptData.paymentId})`,
          text: `Thank you for your payment of ₹${receiptData.amount} for Deal #${receiptData.dealShortId}. Payment ID: ${receiptData.paymentId}. Track your review: ${process.env.SITE_URL || 'https://perpage-app.onrender.com'}/dashboard`,
          html: clientHtml
        }).then(info => {
          console.log(`✅ [Nodemailer] Client Receipt delivered to ${clientEmail} (${info.messageId})`);
        }).catch(err => {
          console.warn(`⚠️ [Nodemailer] Could not send receipt to client ${clientEmail}:`, err.message);
        })
      );
    }

    // 2. Dispatch official payment received alert to Editor
    if (editorEmail) {
      const editorHtml = generateEditorEscrowHtml({ receiptData, client, editor, deal });
      dispatchJobs.push(
        mailTransporter.sendMail({
          from: `"PerPage Platform" <${process.env.EMAIL_USER || 'no-reply@perpage.edu'}>`,
          to: editorEmail,
          subject: `Payment Confirmed: ₹${receiptData.amount} Received for Deal #${receiptData.dealShortId}`,
          text: `Client ${client?.name || 'Client'} has paid ₹${receiptData.amount} for Deal #${receiptData.dealShortId} via Razorpay (ID: ${receiptData.paymentId}). You are authorized to begin review. Open queue: ${process.env.SITE_URL || 'https://perpage-app.onrender.com'}/dashboard?view=incoming`,
          html: editorHtml
        }).then(info => {
          console.log(`✅ [Nodemailer] Editor Payment Alert delivered to ${editorEmail} (${info.messageId})`);
        }).catch(err => {
          console.warn(`⚠️ [Nodemailer] Could not send payment alert to editor ${editorEmail}:`, err.message);
        })
      );
    }

    await Promise.allSettled(dispatchJobs);
  } else {
    console.log(`ℹ️ [Nodemailer] To enable live email delivery, configure EMAIL_USER & EMAIL_PASS in your environment.`);
  }

  return {
    success: true,
    receiptNumber,
    receiptData
  };
}

/**
 * Dispatch official Client "Order Accepted — Payment Due" Notification Email
 */
export async function sendOrderAcceptedEmail({ client, editor, deal }) {
  if (!client || !client.email) return null;
  const dealShortId = deal?._id ? deal._id.toString().slice(-6).toUpperCase() : '000000';
  const pages = deal?.pages || '—';
  const totalPrice = deal?.totalPrice ? `₹${Number(deal.totalPrice).toLocaleString('en-IN')}` : '₹0';
  const siteUrl = (process.env.SITE_URL || 'https://perpage-app.onrender.com').replace(/\/+$/, '');
  const editorName = editor?.name || 'Your editor';

  console.log(`\n============================================================`);
  console.log(`PERPAGE ORDER ACCEPTED — PAYMENT DUE NOTIFICATION`);
  console.log(`Client:           ${client.name || 'Client'} <${client.email}>`);
  console.log(`Editor:           ${editorName}`);
  console.log(`Deal:             #${dealShortId} (${pages} pages • ${totalPrice})`);
  console.log(`Status:           Accepted — Awaiting Payment`);
  console.log(`============================================================\n`);

  const mailTransporter = getTransporter();
  if (mailTransporter) {
    try {
      const emailHtml = `<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
    <div style="margin-bottom: 24px;">
      <span style="font-family: Georgia, serif; font-size: 20px; font-weight: bold; color: #0f172a;">perpage<span style="color: #0284c7;">.</span></span>
    </div>
    <div style="display: inline-block; padding: 4px 10px; border-radius: 9999px; background: #fef3c7; color: #92400e; font-size: 11px; font-weight: 600; text-transform: uppercase; margin-bottom: 16px;">
      Payment Due · Order Accepted
    </div>
    <h1 style="font-size: 20px; margin: 0 0 12px; font-weight: 700; color: #0f172a;">
      Your editor accepted your order #${dealShortId}
    </h1>
    <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px;">
      <strong>${editorName}</strong> has accepted your manuscript for review. Please complete payment so they can begin working on your document.
    </p>
    <div style="background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; padding: 16px; margin-bottom: 24px;">
      <table style="width: 100%; font-size: 13px; color: #475569;">
        <tr>
          <td style="padding: 4px 0;">Manuscript Pages:</td>
          <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #0f172a;">${pages} pages</td>
        </tr>
        <tr>
          <td style="padding: 4px 0;">Total Amount:</td>
          <td style="padding: 4px 0; text-align: right; font-weight: 700; color: #0f172a; font-size: 15px;">${totalPrice}</td>
        </tr>
      </table>
    </div>
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${siteUrl}/dashboard?view=orders&status=active#deal-${deal?._id}" style="display: inline-block; background: #0284c7; color: #ffffff; padding: 12px 28px; border-radius: 9999px; font-weight: 600; font-size: 14px; text-decoration: none;">
        Complete Payment &rarr;
      </a>
    </div>
    <p style="font-size: 12px; color: #94a3b8; margin: 0; text-align: center;">
      This is an automated notification from PerPage.
    </p>
  </div>
</body>
</html>`;

      const info = await mailTransporter.sendMail({
        from: `"PerPage Editorial" <${process.env.EMAIL_USER || 'no-reply@perpage.edu'}>`,
        to: client.email,
        subject: `Order #${dealShortId} Accepted — Payment Due (${totalPrice})`,
        text: `Your editor ${editorName} accepted your order #${dealShortId} (${pages} pages • ${totalPrice}). Complete payment on PerPage to begin review: ${siteUrl}/dashboard?view=orders&status=active`,
        html: emailHtml
      });
      console.log(`✅ [Nodemailer] Order Accepted email sent to ${client.email} (${info.messageId})`);
      return info;
    } catch (err) {
      console.warn(`⚠️ [Nodemailer] Could not send accepted email to ${client.email}:`, err.message);
    }
  }
  return null;
}

/**
 * Dispatch official Editor "Order Completed & Funds Released" Notification Email
 */
export async function sendOrderCompletedEmail({ client, editor, deal }) {
  if (!editor || !editor.email) return null;
  const dealShortId = deal?._id ? deal._id.toString().slice(-6).toUpperCase() : '000000';
  const totalPrice = deal?.totalPrice ? `₹${Number(deal.totalPrice).toLocaleString('en-IN')}` : '₹0';
  const siteUrl = (process.env.SITE_URL || 'https://perpage-app.onrender.com').replace(/\/+$/, '');
  const clientName = client?.name || 'The client';

  const mailTransporter = getTransporter();
  if (mailTransporter) {
    try {
      const emailHtml = `<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
    <div style="margin-bottom: 24px;">
      <span style="font-family: Georgia, serif; font-size: 20px; font-weight: bold; color: #0f172a;">perpage<span style="color: #0284c7;">.</span></span>
    </div>
    <div style="display: inline-block; padding: 4px 10px; border-radius: 9999px; background: #dcfce7; color: #166534; font-size: 11px; font-weight: 600; text-transform: uppercase; margin-bottom: 16px;">
      Order Completed · Payout Ready
    </div>
    <h1 style="font-size: 20px; margin: 0 0 12px; font-weight: 700; color: #0f172a;">
      ${clientName} confirmed receipt for Order #${dealShortId}
    </h1>
    <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px;">
      Great work! The client has accepted your delivered draft and marked the review as completed. Your earnings of <strong>${totalPrice}</strong> are confirmed.
    </p>
    <div style="background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; padding: 16px; margin-bottom: 24px;">
      <table style="width: 100%; font-size: 13px; color: #475569;">
        <tr>
          <td style="padding: 4px 0;">Order Reference:</td>
          <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #0f172a;">DEAL #${dealShortId}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0;">Total Earnings:</td>
          <td style="padding: 4px 0; text-align: right; font-weight: 700; color: #16a34a; font-size: 15px;">${totalPrice}</td>
        </tr>
      </table>
    </div>
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${siteUrl}/dashboard?status=completed" style="display: inline-block; background: #0284c7; color: #ffffff; padding: 12px 28px; border-radius: 9999px; font-weight: 600; font-size: 14px; text-decoration: none;">
        View Completed Orders &rarr;
      </a>
    </div>
  </div>
</body>
</html>`;

      const info = await mailTransporter.sendMail({
        from: `"PerPage Platform" <${process.env.EMAIL_USER || 'no-reply@perpage.edu'}>`,
        to: editor.email,
        subject: `Order #${dealShortId} Completed — Earnings Confirmed (${totalPrice})`,
        text: `Client ${clientName} confirmed receipt for Order #${dealShortId}. Earnings of ${totalPrice} are confirmed. View dashboard: ${siteUrl}/dashboard?status=completed`,
        html: emailHtml
      });
      console.log(`✅ [Nodemailer] Order Completed email sent to editor ${editor.email} (${info.messageId})`);
      return info;
    } catch (err) {
      console.warn(`⚠️ [Nodemailer] Could not send completed email to editor ${editor.email}:`, err.message);
    }
  }
  return null;
}

export default {
  sendRazorpayReceiptEmail,
  sendOrderAcceptedEmail,
  sendOrderCompletedEmail
};
