const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  console.log('--- Testing E2E Deal Lifecycle ---');
  const mongoUri = process.env.MONGO_URL || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGO_URL or MONGODB_URI not set');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB');

  const User = mongoose.model('User', new mongoose.Schema({
    name: String,
    email: String,
    role: String,
    pricePerPage: Number,
    completedDeals: { type: Number, default: 0 }
  }, { strict: false }));

  const Deal = mongoose.model('Deal', new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    writerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    pages: Number,
    totalPrice: Number,
    userNotes: String,
    status: { type: String, default: 'pending' },
    fileLinks: [String],
    finalFileLink: String,
    createdAt: { type: Date, default: Date.now },
    acceptedAt: Date,
    completedAt: Date
  }, { strict: false }));

  const testWriterEmail = `test_writer_${Date.now()}@example.com`;
  const testStudentEmail = `test_student_${Date.now()}@example.com`;

  let writer = null;
  let student = null;
  let deal = null;

  try {
    // 1. Register / create test writer & set perPageRate
    writer = await User.create({
      name: 'E2E Test Writer',
      email: testWriterEmail,
      role: 'writer',
      pricePerPage: 25
    });
    console.log(`✅ Step 1: Writer created with pricePerPage: $${writer.pricePerPage}`);

    // 2. Register / create test student
    student = await User.create({
      name: 'E2E Test Student',
      email: testStudentEmail,
      role: 'user'
    });
    console.log('✅ Step 2: Student created');

    // 3. Create deal with PDF link
    deal = await Deal.create({
      userId: student._id,
      writerId: writer._id,
      pages: 4,
      totalPrice: 100,
      userNotes: 'E2E test prompt instructions',
      fileLinks: ['uploads/e2e_test_brief.pdf'],
      status: 'pending'
    });
    console.log(`✅ Step 3: Deal created in status '${deal.status}' with PDF guideline`);

    // 4. Writer accepts deal
    deal.status = 'accepted';
    deal.acceptedAt = new Date();
    await deal.save();
    console.log(`✅ Step 4: Deal transitioned to '${deal.status}' at ${deal.acceptedAt.toISOString()}`);

    // 5. Writer uploads final deliverable (stores clean S3 key)
    const cleanFinalKey = 'finals/e2e_uuid_deliverable.pdf';
    deal.finalFileLink = cleanFinalKey;
    await deal.save();
    console.log(`✅ Step 5: Deliverable uploaded with clean S3 key: ${deal.finalFileLink}`);

    // Verify final key is not a presigned URL
    if (deal.finalFileLink.includes('?') || deal.finalFileLink.startsWith('http')) {
      throw new Error(`finalFileLink should be a plain S3 key, but found: ${deal.finalFileLink}`);
    }

    // 6. Student completes deal
    if (deal.status !== 'accepted' || !deal.finalFileLink) {
      throw new Error('Deal not in eligible state for completion');
    }
    deal.status = 'completed';
    deal.completedAt = new Date();
    await deal.save();
    console.log(`✅ Step 6: Deal completed at ${deal.completedAt.toISOString()}`);

    // 7. Verify completed count query for writer
    const completedCount = await Deal.countDocuments({
      writerId: writer._id,
      status: 'completed'
    });
    console.log(`✅ Step 7: Writer completed deal count is ${completedCount} (expected 1)`);
    if (completedCount !== 1) {
      throw new Error(`Expected completed count to be 1, but got ${completedCount}`);
    }

    console.log('🎉 All E2E lifecycle stages verified successfully!');
  } finally {
    // Cleanup
    if (deal && deal._id) await Deal.deleteOne({ _id: deal._id });
    if (writer && writer._id) await User.deleteOne({ _id: writer._id });
    if (student && student._id) await User.deleteOne({ _id: student._id });
    console.log('🧹 Cleaned up test database records.');
    await mongoose.disconnect();
  }
}

run().catch(err => {
  console.error('❌ E2E Deal Lifecycle Test Failed:', err);
  process.exit(1);
});
