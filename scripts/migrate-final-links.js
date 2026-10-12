import dns from 'node:dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Deal from '../models/deal.js';

dotenv.config();

function extractKey(urlOrKey) {
  if (!urlOrKey || typeof urlOrKey !== 'string') return null;
  if (urlOrKey.startsWith('finals/')) return urlOrKey;

  try {
    const parsed = new URL(urlOrKey);
    let pathname = decodeURIComponent(parsed.pathname);
    if (pathname.startsWith('/')) {
      pathname = pathname.substring(1);
    }
    const idx = pathname.indexOf('finals/');
    if (idx !== -1) {
      return pathname.substring(idx);
    }
    return null;
  } catch {
    return null;
  }
}

async function run() {
  const isApply = process.argv.includes('--apply');
  console.log(`=== PerPage S3 Final Link Migration ===`);
  console.log(`Mode: ${isApply ? 'APPLY (writing changes)' : 'DRY RUN (read-only preview)'}\n`);

  if (!process.env.MONGO_URL) {
    console.error('❌ MONGO_URL environment variable is not defined.');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log('✅ Connected to MongoDB');

    const deals = await Deal.find({
      finalFileLink: { $exists: true, $ne: null, $nin: [''] }
    });

    console.log(`Found ${deals.length} deals with a finalFileLink.`);

    let candidatesCount = 0;
    let unchangedCount = 0;

    for (const deal of deals) {
      const currentLink = deal.finalFileLink;

      // Check if it's a URL rather than a plain key
      if (currentLink.startsWith('http://') || currentLink.startsWith('https://')) {
        const extractedKey = extractKey(currentLink);
        if (extractedKey) {
          candidatesCount++;
          console.log(`[${isApply ? 'APPLY' : 'DRY RUN'}] Deal ${deal._id}:`);
          console.log(`   From: ${currentLink.slice(0, 70)}...`);
          console.log(`   To:   ${extractedKey}`);

          if (isApply) {
            await Deal.updateOne(
              { _id: deal._id },
              { $set: { finalFileLink: extractedKey } }
            );
          }
        } else {
          console.warn(`[SKIP] Deal ${deal._id}: URL could not be parsed to a finals/ S3 key (${currentLink.slice(0, 50)}...)`);
        }
      } else {
        unchangedCount++;
      }
    }

    console.log('\n=== Migration Summary ===');
    console.log(`Total inspected: ${deals.length}`);
    console.log(`Already plain keys: ${unchangedCount}`);
    console.log(`Candidates identified: ${candidatesCount}`);
    if (isApply) {
      console.log(`Status: Successfully updated ${candidatesCount} deals.`);
    } else {
      console.log(`Status: Dry run complete. No records were modified.`);
      console.log(`Run with --apply to commit changes to the database.`);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration script failed:', err.message);
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
}

run();
