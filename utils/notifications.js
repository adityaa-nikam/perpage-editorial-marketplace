import mongoose from 'mongoose';
import Notification from '../models/Notification.js';

// In-memory notifications store for mock sessions, tests, and non-DB preview mode
export const MOCK_NOTIFICATIONS = [];

/**
 * Automatically ensures an 'order_accepted' notification exists for any accepted, unpaid deal
 */
export async function ensurePendingPaymentNotifications(userId) {
  if (!userId) return;
  const isDbConnected = mongoose.connection.readyState === 1;

  if (isDbConnected) {
    try {
      const Deal = mongoose.models.Deal;
      if (Deal) {
        const unpaidDeals = await Deal.find({
          userId: userId,
          status: { $in: ['accepted', 'in-progress'] },
          paymentStatus: { $ne: 'paid' }
        }).populate('writerId', 'name').lean();

        for (const d of unpaidDeals) {
          const exists = await Notification.findOne({
            recipient: userId,
            dealId: d._id,
            type: { $in: ['order_accepted', 'payment_pending'] }
          });
          if (!exists) {
            const editorName = d.writerId?.name || 'Your editor';
            const dealShortId = d._id ? d._id.toString().slice(-6).toUpperCase() : '';
            const priceFmt = Number(d.totalPrice || 0).toLocaleString('en-IN');
            await createNotification({
              recipient: userId,
              sender: d.writerId?._id || d.writerId || null,
              dealId: d._id,
              type: 'order_accepted',
              title: 'Order Accepted — Payment Due',
              message: `${editorName} accepted your order #${dealShortId} (${d.pages} pages • ₹${priceFmt}). Please complete payment so they can begin working on your manuscript.`,
              link: `/dashboard?view=orders&status=active#deal-${d._id}`
            });
          }
        }
      }
    } catch (err) {
      console.error('ensurePendingPaymentNotifications error:', err.message);
    }
  }
}

/**
 * Create a new notification for a recipient
 */
export async function createNotification({ recipient, sender = null, dealId = null, type = 'general', title, message, link = '/dashboard' }) {
  if (!recipient) return null;
  
  const recipientIdStr = recipient.toString();
  const recipientObj = (recipient && mongoose.Types.ObjectId.isValid(recipient))
    ? new mongoose.Types.ObjectId(recipient)
    : recipient;
  const senderObj = (sender && mongoose.Types.ObjectId.isValid(sender))
    ? new mongoose.Types.ObjectId(sender)
    : null;
  const dealIdObj = (dealId && mongoose.Types.ObjectId.isValid(dealId))
    ? new mongoose.Types.ObjectId(dealId)
    : null;

  const isDbConnected = mongoose.connection.readyState === 1;

  if (isDbConnected) {
    try {
      const notification = new Notification({
        recipient: recipientObj,
        sender: senderObj,
        dealId: dealIdObj,
        type,
        title,
        message,
        link,
        read: false,
        createdAt: new Date()
      });
      await notification.save();
      return notification;
    } catch (err) {
      console.error('Error creating notification in DB:', err.message);
    }
  }

  // In-memory fallback
  const mockItem = {
    _id: new mongoose.Types.ObjectId(),
    recipient: recipientIdStr,
    sender: sender ? sender.toString() : null,
    dealId: dealId ? dealId.toString() : null,
    type,
    title,
    message,
    link,
    read: false,
    createdAt: new Date()
  };
  MOCK_NOTIFICATIONS.unshift(mockItem);
  return mockItem;
}

/**
 * Retrieve notifications for a specific user
 */
export async function getUserNotifications(userId, limit = 15) {
  if (!userId) return [];
  const userIdStr = userId.toString();
  const isDbConnected = mongoose.connection.readyState === 1;

  await ensurePendingPaymentNotifications(userId);

  if (isDbConnected) {
    try {
      const docs = await Notification.find({ recipient: userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
      return docs;
    } catch (err) {
      console.error('Error fetching notifications from DB:', err.message);
    }
  }

  return MOCK_NOTIFICATIONS
    .filter(n => n.recipient === userIdStr)
    .slice(0, limit);
}

/**
 * Get unread notifications count for a user
 */
export async function getUnreadCount(userId) {
  if (!userId) return 0;
  const userIdStr = userId.toString();
  const isDbConnected = mongoose.connection.readyState === 1;

  await ensurePendingPaymentNotifications(userId);

  if (isDbConnected) {
    try {
      return await Notification.countDocuments({ recipient: userId, read: false });
    } catch (err) {
      console.error('Error counting unread notifications:', err.message);
    }
  }

  return MOCK_NOTIFICATIONS.filter(n => n.recipient === userIdStr && !n.read).length;
}

/**
 * Mark a single notification as read
 */
export async function markAsRead(notificationId, userId) {
  if (!notificationId) return false;
  const notifIdStr = notificationId.toString();
  const userIdStr = userId ? userId.toString() : null;
  const isDbConnected = mongoose.connection.readyState === 1;

  if (isDbConnected) {
    try {
      const query = { _id: notificationId };
      if (userId) query.recipient = userId;
      await Notification.updateOne(query, { $set: { read: true } });
      return true;
    } catch (err) {
      console.error('Error marking notification read in DB:', err.message);
    }
  }

  const found = MOCK_NOTIFICATIONS.find(n => n._id.toString() === notifIdStr && (!userIdStr || n.recipient === userIdStr));
  if (found) {
    found.read = true;
    return true;
  }
  return false;
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId) {
  if (!userId) return false;
  const userIdStr = userId.toString();
  const isDbConnected = mongoose.connection.readyState === 1;

  if (isDbConnected) {
    try {
      await Notification.updateMany({ recipient: userId, read: false }, { $set: { read: true } });
      return true;
    } catch (err) {
      console.error('Error marking all notifications read in DB:', err.message);
    }
  }

  MOCK_NOTIFICATIONS.forEach(n => {
    if (n.recipient === userIdStr) {
      n.read = true;
    }
  });
  return true;
}
