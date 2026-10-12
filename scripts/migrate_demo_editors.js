import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { User } from '../models/User.js';

const DEMO_UPDATES = {
  'demo-writer-1@example.com': {
    name: 'Arthur Pendelton',
    bio: 'Edits reports, essays and cover letters for clarity and structure.'
  },
  'demo-writer-2@example.com': {
    name: 'Elena Rostova',
    bio: 'Reviews draft flow, sentence structure and overall document readability.'
  },
  'demo-writer-3@example.com': {
    name: 'Marcus Vance',
    bio: 'Provides line editing and detailed comments on tone and phrasing.'
  },
  'demo-writer-4@example.com': {
    name: 'Maya Lin',
    bio: 'Edits personal drafts and professional documents for clear exposition.'
  },
  'demo-writer-5@example.com': {
    name: 'Geoffrey Hawkes',
    bio: 'Focuses on document organization, paragraph transitions and conciseness.'
  },
  'demo-writer-6@example.com': {
    name: 'Claire Beauchamp',
    bio: 'Assists clients with formatting, language polish and constructive feedback.'
  },
  'demo-writer-7@example.com': {
    name: 'Devon Miller',
    bio: 'Proofreads text for grammar, punctuation and consistent style.'
  },
  'demo-writer-8@example.com': {
    name: 'Zara Qureshi',
    bio: 'Edits personal statements, articles and project reports for clarity.'
  }
};

async function run() {
  const mongoUrl = process.env.MONGO_URI || process.env.MONGO_URL;
  if (!mongoUrl) {
    console.error('No MONGO_URI found in env');
    process.exit(1);
  }

  await mongoose.connect(mongoUrl);
  console.log('Connected to MongoDB. Updating seeded demo editors...');

  for (const [email, update] of Object.entries(DEMO_UPDATES)) {
    const existing = await User.findOne({ email });
    if (existing) {
      console.log(`BEFORE [${email}]: name="${existing.name}", bio="${existing.bio}"`);
      existing.name = update.name;
      existing.bio = update.bio;
      await existing.save();
      console.log(`AFTER  [${email}]: name="${existing.name}", bio="${existing.bio}"\n`);
    } else {
      console.log(`No user found for ${email}`);
    }
  }

  console.log('✅ Demo editors update complete.');
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
