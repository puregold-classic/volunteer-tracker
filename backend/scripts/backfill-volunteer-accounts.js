import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Volunteer from '../src/models/Volunteer.js';
import Account from '../src/models/Account.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/volunteer_tracker';
const DEFAULT_PASSWORD = process.env.DEFAULT_VOLUNTEER_PASSWORD || 'Volunteer@123';
const APPLY = process.argv.includes('--apply');

const buildFallbackEmail = (volunteerId) => `${String(volunteerId).toLowerCase()}@volunteer.local`;

async function backfillVolunteerAccounts() {
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000
  });

  try {
    const volunteers = await Volunteer.find({}).lean();
    const accounts = await Account.find({}).select('email volunteerId').lean();
    const volunteerIdSet = new Set(accounts.filter((a) => a.volunteerId).map((a) => a.volunteerId));
    const emailSet = new Set(accounts.map((a) => a.email.toLowerCase()));

    const missing = volunteers.filter((v) => !volunteerIdSet.has(v.id));
    console.log(`Total volunteers: ${volunteers.length}`);
    console.log(`Volunteers without account: ${missing.length}`);

    if (!APPLY) {
      console.log('Dry run only. Re-run with --apply to write data.');
      for (const v of missing.slice(0, 20)) {
        const preferred = (v.email || buildFallbackEmail(v.id)).toLowerCase();
        console.log(`- ${v.id} ${v.chineseName} -> ${preferred}`);
      }
      return;
    }

    let created = 0;
    for (const v of missing) {
      let email = (v.email || buildFallbackEmail(v.id)).toLowerCase();
      if (emailSet.has(email)) {
        email = `${String(v.id).toLowerCase()}+${Date.now()}@volunteer.local`;
      }

      const passwordHash = await Account.hashPassword(DEFAULT_PASSWORD);
      await Account.create({
        email,
        passwordHash,
        name: v.chineseName || v.englishName || v.id,
        role: 'user',
        volunteerId: v.id,
        isActive: true
      });
      emailSet.add(email);
      created += 1;
    }

    console.log(`Created accounts: ${created}`);
    console.log(`Default password for created accounts: ${DEFAULT_PASSWORD}`);
  } finally {
    await mongoose.connection.close();
  }
}

backfillVolunteerAccounts()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('backfill-volunteer-accounts failed:', error);
    process.exit(1);
  });
