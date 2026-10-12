import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import Deal from '../models/deal.js';

// Safety Guard: Refuse to run unless NODE_ENV is not 'production' AND MONGO_URL points to localhost or 127.0.0.1
const mongoUrl = process.env.MONGO_URL || process.env.MONGO_URI || '';
const isLocal = mongoUrl.includes('localhost') || mongoUrl.includes('127.0.0.1');
const isProd = process.env.NODE_ENV === 'production';
const allowDevCluster = process.env.ALLOW_DEV_CLUSTER_SEED === 'true' && !isProd;

if (isProd || (!isLocal && !allowDevCluster)) {
  console.error("❌ Refusing to run: NODE_ENV must not be 'production' AND MONGO_URL must point to localhost or 127.0.0.1.");
  console.error(`   Current NODE_ENV: '${process.env.NODE_ENV || 'development'}'`);
  console.error(`   Current MONGO_URL: '${mongoUrl ? mongoUrl.replace(/:[^:]*@/, ':****@') : 'UNSET'}'`);
  console.error("   To seed local MongoDB, set MONGO_URL=mongodb://localhost:27017/perpage");
  process.exit(1);
}

const isRemove = process.argv.includes('--remove');

async function main() {
  try {
    await mongoose.connect(mongoUrl);
    const dbName = mongoose.connection.name || 'perpage';
    const host = mongoose.connection.host || 'localhost';
    console.log(`🎯 Targeting database: '${dbName}' on host '${host}'`);

    const DEMO_WRITER_REGEX = /^demo-writer-\d+@example\.com$/;
    const DEMO_STUDENT_REGEX = /^demo-student-\d+@example\.com$/;
    const DEMO_DEAL_NOTE_PREFIX = '[DEMO SEED]';

    if (isRemove) {
      console.log('🧹 Removing all seeded demo data...');
      // Find IDs of demo users to safely purge associated deals
      const demoUsers = await User.find({
        $or: [
          { email: { $regex: DEMO_WRITER_REGEX } },
          { email: { $regex: DEMO_STUDENT_REGEX } }
        ]
      }).select('_id');
      const demoUserIds = demoUsers.map(u => u._id);

      const dealsDeleted = await Deal.deleteMany({
        $or: [
          { userNotes: { $regex: /^\\[DEMO SEED\\]/ } },
          { userId: { $in: demoUserIds } },
          { writerId: { $in: demoUserIds } }
        ]
      });
      const writersDeleted = await User.deleteMany({ email: { $regex: DEMO_WRITER_REGEX } });
      const studentsDeleted = await User.deleteMany({ email: { $regex: DEMO_STUDENT_REGEX } });

      console.log(`✅ Removed:
  - ${writersDeleted.deletedCount} demo writers
  - ${studentsDeleted.deletedCount} demo students
  - ${dealsDeleted.deletedCount} demo deals`);
      await mongoose.disconnect();
      return process.exit(0);
    }

    console.log('🌱 Idempotently seeding realistic demo data...');

    // 1. Clean existing demo data first to guarantee idempotency (no duplicates)
    const existingDemoUsers = await User.find({
      $or: [
        { email: { $regex: DEMO_WRITER_REGEX } },
        { email: { $regex: DEMO_STUDENT_REGEX } }
      ]
    }).select('_id');
    const existingIds = existingDemoUsers.map(u => u._id);

    await Deal.deleteMany({
      $or: [
        { userNotes: { $regex: /^\\[DEMO SEED\\]/ } },
        { userId: { $in: existingIds } },
        { writerId: { $in: existingIds } }
      ]
    });
    await User.deleteMany({ email: { $regex: DEMO_WRITER_REGEX } });
    await User.deleteMany({ email: { $regex: DEMO_STUDENT_REGEX } });

    const hashedPassword = await bcrypt.hash('DemoPassword123!', 10);

    // 2. Define 8 Demo Writers with diverse names, bios, and rates
    const demoWritersData = [
      {
        name: 'Ananya Sharma',
        email: 'demo-writer-1@example.com',
        role: 'writer',
        password: hashedPassword,
        pricePerPage: 45,
        bio: 'Edits reports, essays and cover letters for clarity and structure.',
        address: 'New Delhi, India'
      },
      {
        name: 'Rohan Verma',
        email: 'demo-writer-2@example.com',
        role: 'writer',
        password: hashedPassword,
        pricePerPage: 38,
        bio: 'Reviews draft flow, sentence structure and overall document readability.',
        address: 'Bengaluru, India'
      },
      {
        name: 'Dr. Meera Iyer',
        email: 'demo-writer-3@example.com',
        role: 'writer',
        password: hashedPassword,
        pricePerPage: 60,
        bio: 'Provides line editing and detailed comments on tone and phrasing.',
        address: 'Chennai, India'
      },
      {
        name: 'Arjun Patel',
        email: 'demo-writer-4@example.com',
        role: 'writer',
        password: hashedPassword,
        pricePerPage: 32,
        bio: 'Edits personal drafts and professional documents for clear exposition.',
        address: 'Ahmedabad, India'
      },
      {
        name: 'Kabir Sengupta',
        email: 'demo-writer-5@example.com',
        role: 'writer',
        password: hashedPassword,
        pricePerPage: 65,
        bio: 'Focuses on document organization, paragraph transitions and conciseness.',
        address: 'Kolkata, India'
      },
      {
        name: 'Priya Nair',
        email: 'demo-writer-6@example.com',
        role: 'writer',
        password: hashedPassword,
        pricePerPage: 50,
        bio: 'Assists clients with formatting, language polish and constructive feedback.',
        address: 'Kochi, India'
      },
      {
        name: 'Sneha Kulkarni',
        email: 'demo-writer-7@example.com',
        role: 'writer',
        password: hashedPassword,
        pricePerPage: 0, // Intentionally rate not set (0)
        bio: 'Proofreads text for grammar, punctuation and consistent style.',
        address: 'Pune, India'
      },
      {
        name: 'Aditya Joshi',
        email: 'demo-writer-8@example.com',
        role: 'writer',
        password: hashedPassword,
        pricePerPage: 42,
        bio: 'Edits personal statements, articles and project reports for clarity.',
        address: 'Mumbai, India'
      }
    ];

    const seededWriters = await User.insertMany(demoWritersData);
    console.log(`✅ Seeded ${seededWriters.length} demo writers`);

    // 3. Define 2 Demo Students
    const demoStudentsData = [
      {
        name: 'Rahul Taneja',
        email: 'demo-student-1@example.com',
        role: 'user',
        password: hashedPassword,
        pricePerPage: 0,
        bio: 'Undergraduate student in Economics and Public Policy.',
        address: 'New Delhi, India'
      },
      {
        name: 'Ishaan Malhotra',
        email: 'demo-student-2@example.com',
        role: 'user',
        password: hashedPassword,
        pricePerPage: 0,
        bio: 'Graduate researcher in Environmental Science & Public Health.',
        address: 'Mumbai, India'
      }
    ];

    const seededStudents = await User.insertMany(demoStudentsData);
    console.log(`✅ Seeded ${seededStudents.length} demo students`);

    const s1 = seededStudents[0]._id;
    const s2 = seededStudents[1]._id;
    const w1 = seededWriters[0]._id; // Ananya (45)
    const w2 = seededWriters[1]._id; // Rohan (38)
    const w3 = seededWriters[2]._id; // Meera (60)
    const w4 = seededWriters[3]._id; // Arjun (32)
    const w5 = seededWriters[4]._id; // Kabir (65)
    const w6 = seededWriters[5]._id; // Priya (50)
    const w8 = seededWriters[7]._id; // Aditya (42)

    // 4. Seed ~12 Deals across reachable statuses (pending, accepted, delivered/finalFileLink, completed, rejected)
    const demoDealsData = [
      // S1 deals
      {
        userId: s1,
        writerId: w1,
        pages: 6,
        totalPrice: 270,
        status: 'pending',
        userNotes: `${DEMO_DEAL_NOTE_PREFIX} Comparative paper examining monetary policy frameworks between the Bretton Woods era and contemporary central banking.`,
        fileLinks: ['uploads/placeholder-prompt-1.pdf'],
        createdAt: new Date(Date.now() - 3600000 * 3)
      },
      {
        userId: s1,
        writerId: w2,
        pages: 12,
        totalPrice: 456,
        status: 'accepted',
        userNotes: `${DEMO_DEAL_NOTE_PREFIX} Close textual reading of polyphonic dialogue in 19th-century epistolary fiction. MLA 9th format.`,
        fileLinks: ['uploads/placeholder-prompt-2.pdf'],
        createdAt: new Date(Date.now() - 3600000 * 24),
        acceptedAt: new Date(Date.now() - 3600000 * 20)
      },
      {
        userId: s1,
        writerId: w3,
        pages: 8,
        totalPrice: 480,
        status: 'accepted',
        finalFileLink: 'finals/demo-multivariate-regression.pdf',
        userNotes: `${DEMO_DEAL_NOTE_PREFIX} Econometric regression analysis assessing capital expenditure sensitivities during interest rate spikes.`,
        writerNotes: 'Delivered final draft complete with R-squared regression tables and diagnostic residual plots.',
        fileLinks: ['uploads/placeholder-prompt-3.pdf'],
        createdAt: new Date(Date.now() - 3600000 * 48),
        acceptedAt: new Date(Date.now() - 3600000 * 36)
      },
      {
        userId: s1,
        writerId: w5,
        pages: 15,
        totalPrice: 1125,
        status: 'completed',
        finalFileLink: 'finals/demo-monograph-review.pdf',
        userNotes: `${DEMO_DEAL_NOTE_PREFIX} Comprehensive literature review on social contract theory in post-war European constitutional courts.`,
        writerNotes: 'Delivered 15-page essay with Oxford referencing style and primary case law citations.',
        fileLinks: ['uploads/placeholder-prompt-4.pdf'],
        createdAt: new Date(Date.now() - 3600000 * 96),
        acceptedAt: new Date(Date.now() - 3600000 * 80),
        completedAt: new Date(Date.now() - 3600000 * 12)
      },
      {
        userId: s1,
        writerId: w6,
        pages: 5,
        totalPrice: 250,
        status: 'rejected',
        userNotes: `${DEMO_DEAL_NOTE_PREFIX} Laboratory protocol assessment for crispr-cas9 gene drive modeling.`,
        fileLinks: ['uploads/placeholder-prompt-5.pdf'],
        createdAt: new Date(Date.now() - 3600000 * 72)
      },
      {
        userId: s1,
        writerId: w1,
        pages: 4,
        totalPrice: 180,
        status: 'completed',
        finalFileLink: 'finals/demo-macro-essay.pdf',
        userNotes: `${DEMO_DEAL_NOTE_PREFIX} Brief policy memo evaluating sovereign wealth fund diversification tactics.`,
        writerNotes: 'Delivered memo with executive summary and risk matrix appendix.',
        fileLinks: ['uploads/placeholder-prompt-6.pdf'],
        createdAt: new Date(Date.now() - 3600000 * 120),
        acceptedAt: new Date(Date.now() - 3600000 * 100),
        completedAt: new Date(Date.now() - 3600000 * 24)
      },

      // S2 deals
      {
        userId: s2,
        writerId: w1,
        pages: 10,
        totalPrice: 450,
        status: 'pending',
        userNotes: `${DEMO_DEAL_NOTE_PREFIX} Historical institutional analysis of the 1973 oil embargo impacts on UK manufacturing.`,
        fileLinks: ['uploads/placeholder-prompt-7.pdf'],
        createdAt: new Date(Date.now() - 3600000 * 5)
      },
      {
        userId: s2,
        writerId: w2,
        pages: 7,
        totalPrice: 266,
        status: 'pending',
        userNotes: `${DEMO_DEAL_NOTE_PREFIX} Comparative critique of modernist narrative techniques in early 20th-century European prose.`,
        fileLinks: ['uploads/placeholder-prompt-8.pdf'],
        createdAt: new Date(Date.now() - 3600000 * 8)
      },
      {
        userId: s2,
        writerId: w3,
        pages: 9,
        totalPrice: 540,
        status: 'accepted',
        userNotes: `${DEMO_DEAL_NOTE_PREFIX} Statistical meta-analysis of randomized control trials in public health interventions.`,
        fileLinks: ['uploads/placeholder-prompt-9.pdf'],
        createdAt: new Date(Date.now() - 3600000 * 30),
        acceptedAt: new Date(Date.now() - 3600000 * 26)
      },
      {
        userId: s2,
        writerId: w4,
        pages: 6,
        totalPrice: 192,
        status: 'accepted',
        finalFileLink: 'finals/demo-ethics-brief.pdf',
        userNotes: `${DEMO_DEAL_NOTE_PREFIX} Applied bioethics assessment of somatic cell genome editing in pediatrics.`,
        writerNotes: 'Delivered bioethics review with peer-reviewed bibliography.',
        fileLinks: ['uploads/placeholder-prompt-10.pdf'],
        createdAt: new Date(Date.now() - 3600000 * 50),
        acceptedAt: new Date(Date.now() - 3600000 * 40)
      },
      {
        userId: s2,
        writerId: w6,
        pages: 14,
        totalPrice: 700,
        status: 'completed',
        finalFileLink: 'finals/demo-biotech-review.pdf',
        userNotes: `${DEMO_DEAL_NOTE_PREFIX} Systematic review of mRNA vaccine adjuvant delivery systems. APA format.`,
        writerNotes: 'Complete manuscript delivered with full citation index.',
        fileLinks: ['uploads/placeholder-prompt-11.pdf'],
        createdAt: new Date(Date.now() - 3600000 * 140),
        acceptedAt: new Date(Date.now() - 3600000 * 110),
        completedAt: new Date(Date.now() - 3600000 * 18)
      },
      {
        userId: s2,
        writerId: w8,
        pages: 8,
        totalPrice: 336,
        status: 'rejected',
        userNotes: `${DEMO_DEAL_NOTE_PREFIX} Experimental methodology evaluation of fMRI resting-state functional connectivity paradigms.`,
        fileLinks: ['uploads/placeholder-prompt-12.pdf'],
        createdAt: new Date(Date.now() - 3600000 * 85)
      }
    ];

    const seededDeals = await Deal.insertMany(demoDealsData);
    console.log(`✅ Seeded ${seededDeals.length} demo deals across reachable statuses (pending, accepted, completed, rejected)`);

    console.log('\n🎉 Demo data seeding complete! Ready for visual baseline inspection.');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Demo seed error:', err.message);
    process.exit(1);
  }
}

main();
