import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Account from '../src/models/Account.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/volunteer_tracker';
const APPLY = process.argv.includes('--apply');

async function migrateAccountVolunteerUnique() {
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000
  });

  try {
    const duplicates = await Account.aggregate([
      { $match: { volunteerId: { $type: 'string', $ne: '' } } },
      { $group: { _id: '$volunteerId', count: { $sum: 1 }, ids: { $push: '$_id' } } },
      { $match: { count: { $gt: 1 } } }
    ]);

    console.log(`Duplicate volunteerId groups: ${duplicates.length}`);
    if (duplicates.length > 0) {
      for (const group of duplicates) {
        console.log(`- volunteerId=${group._id} count=${group.count}`);
      }
    }

    if (APPLY && duplicates.length > 0) {
      for (const group of duplicates) {
        const accounts = await Account.find({ _id: { $in: group.ids } })
          .sort({ createdAt: 1 })
          .select('_id email createdAt')
          .lean();
        const toUnbind = accounts.slice(1).map((a) => a._id);
        if (toUnbind.length > 0) {
          await Account.updateMany({ _id: { $in: toUnbind } }, { $set: { volunteerId: null } });
        }
      }
      console.log('Resolved duplicates by unbinding newer duplicate accounts.');
    }

    const indexes = await Account.collection.indexes();
    const volunteerIndexes = indexes.filter((idx) => idx.key && idx.key.volunteerId === 1);
    const hasDesiredIndex = volunteerIndexes.some(
      (idx) =>
        idx.unique === true &&
        idx.partialFilterExpression &&
        idx.partialFilterExpression.volunteerId &&
        idx.partialFilterExpression.volunteerId.$type === 'string'
    );
    const oldVolunteerIndexes = volunteerIndexes.filter((idx) => !idx.unique);

    if (APPLY) {
      for (const idx of oldVolunteerIndexes) {
        await Account.collection.dropIndex(idx.name);
        console.log(`Dropped old non-unique index: ${idx.name}`);
      }

      if (!hasDesiredIndex) {
        const remainingVolunteerIndexes = (await Account.collection.indexes()).filter(
          (idx) => idx.key && idx.key.volunteerId === 1
        );
        for (const idx of remainingVolunteerIndexes) {
          await Account.collection.dropIndex(idx.name);
          console.log(`Dropped conflicting volunteerId index: ${idx.name}`);
        }

        await Account.collection.createIndex(
          { volunteerId: 1 },
          {
            unique: true,
            partialFilterExpression: {
              volunteerId: { $type: 'string' }
            }
          }
        );
        console.log('Created unique partial index on Account.volunteerId');
      } else {
        console.log('Desired volunteerId unique partial index already exists.');
      }
    } else {
      console.log('Dry run only. Use --apply to resolve duplicates and create unique index.');
    }
  } finally {
    await mongoose.connection.close();
  }
}

migrateAccountVolunteerUnique()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('migrate-account-volunteer-unique failed:', error);
    process.exit(1);
  });
