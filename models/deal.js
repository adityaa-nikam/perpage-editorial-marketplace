import mongoose from "mongoose";

const dealSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId, // ✅ Fix this
    ref: 'User',                         // ✅ Reference the User model
    required: true
  },
  writerId: {
    type: mongoose.Schema.Types.ObjectId, // ✅ Fix this
    ref: 'User',                         // ✅ Reference the User model
    required: true
  },
  fileLinks: {
    type: [String],
    default: []
  },
  finalFileLink: String,
  status: {
    type: String,
    enum: ['pending', 'accepted', 'in-progress', 'submitted', 'completed', 'rejected', 'refunded', 'cancelled'],
    default: 'pending'
  },
  pages: {
    type: Number,
    required: true
  },
  totalPrice: {
    type: Number,
    required: true
  },
  userNotes: {
    type: String,
    default: ''
  },
  writerNotes: {
    type: String,
    default: ''
  },
  submissionFiles: {
    type: [String],
    default: []
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  acceptedAt: Date,
  completedAt: Date,
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'paid', 'refunded'],
    default: 'unpaid'
  },
  payoutStatus: {
    type: String,
    enum: ['unpaid', 'pending', 'paid_out'],
    default: 'unpaid'
  },
  payoutPaidAt: Date,
  refundId: String,
  refundedAt: Date,
  razorpayOrderId: String,
  razorpayPaymentId: String,
  razorpayPaymentLinkId: String,
  razorpaySignature: String,
  razorpayInvoiceId: String,
  razorpayInvoiceUrl: String,
  razorpayPaymentMethod: String,
  paidAt: Date,
  reviewId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Review'
  }
});

const Deal = mongoose.model('Deal', dealSchema);

export default Deal;
