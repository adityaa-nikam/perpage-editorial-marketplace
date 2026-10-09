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
    enum: ['pending', 'accepted', 'in-progress', 'submitted', 'completed', 'rejected'],
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
  completedAt: Date
});

const Deal = mongoose.model('Deal', dealSchema);

export default Deal;
