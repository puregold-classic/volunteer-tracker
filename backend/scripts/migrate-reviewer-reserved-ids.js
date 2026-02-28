import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Account from '../src/models/Account.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/volunteer_tracker';
const APPLY = process.argv.includes('--apply');

const toPg = (n) => `PG-${String(n).padStart(4, '0')}`;

async function migrateReviewerReservedIds() {
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000
  });

  try {
    const accounts = await Account.find({ role: { $in: ['admin', 'a_admin'] } })
      .sort({ createdAt: 1 })
      .select('_id email role volunteerId createdAt')
      .lean();

    const allBound = await Account.find({ volunteerId: { $type: 'string' } }).select('volunteerId').lean();
    const used = new Set(allBound.map((a) => String(a.volunteerId).toUpperCase()));

    const planned = [];

    const adminAccounts = accounts.filter((a) => a.role === 'admin');
    if (adminAccounts.length > 0) {
      const primary = adminAccounts[0];
      if (primary.volunteerId !== 'PG-0000') {
        planned.push({ _id: primary._id, email: primary.email, volunteerId: 'PG-0000' });
      }
      used.add('PG-0000');

      for (const extraAdmin of adminAccounts.slice(1)) {
        let assigned = null;
        for (let n = 9999; n >= 9000; n -= 1) {
          const candidate = toPg(n);
          if (!used.has(candidate)) {
            assigned = candidate;
            used.add(candidate);
            break;
          }
        }
        if (assigned && extraAdmin.volunteerId !== assigned) {
          planned.push({ _id: extraAdmin._id, email: extraAdmin.email, volunteerId: assigned });
        }
      }
    }

    const aAdmins = accounts.filter((a) => a.role === 'a_admin');
    for (const acc of aAdmins) {
      if (acc.volunteerId && /^PG-\d{4}$/i.test(acc.volunteerId)) {
        used.add(String(acc.volunteerId).toUpperCase());
        continue;
      }
      let assigned = null;
      for (let n = 9999; n >= 9000; n -= 1) {
        const candidate = toPg(n);
        if (!used.has(candidate)) {
          assigned = candidate;
          used.add(candidate);
          break;
        }
      }
      if (!assigned) {
        throw new Error('No reserved reviewer ID available in PG-9999..PG-9000');
      }
      planned.push({ _id: acc._id, email: acc.email, volunteerId: assigned });
    }

    console.log(`Accounts needing reserved reviewer IDs: ${planned.length}`);
    for (const item of planned) {
      console.log(`- ${item.email} -> ${item.volunteerId}`);
    }

    if (!APPLY) {
      console.log('Dry run only. Re-run with --apply to write changes.');
      return;
    }

    for (const item of planned) {
      await Account.updateOne({ _id: item._id }, { $set: { volunteerId: item.volunteerId } });
    }
    console.log('Reserved reviewer IDs migrated.');
  } finally {
    await mongoose.connection.close();
  }
}

migrateReviewerReservedIds()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('migrate-reviewer-reserved-ids failed:', error);
    process.exit(1);
  });
