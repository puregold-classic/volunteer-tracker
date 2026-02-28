import mongoose from 'mongoose';
import dotenv from 'dotenv';
import NonProjectService from '../src/models/NonProjectService.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/volunteer_tracker';
const APPLY = process.argv.includes('--apply');

async function dedupeServiceRecords() {
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000
  });

  try {
    const groups = await NonProjectService.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: {
            volunteerId: '$volunteerId',
            serviceDate: '$serviceDate',
            serviceType: '$serviceType',
            duration: '$duration',
            description: '$description'
          },
          count: { $sum: 1 },
          ids: { $push: '$_id' }
        }
      },
      { $match: { count: { $gt: 1 } } }
    ]);

    let duplicateRows = 0;
    for (const g of groups) duplicateRows += g.count - 1;
    console.log(`Duplicate groups: ${groups.length}`);
    console.log(`Duplicate rows to deactivate: ${duplicateRows}`);

    if (!APPLY) {
      console.log('Dry run only. Re-run with --apply to deactivate duplicates and enforce index.');
      return;
    }

    for (const g of groups) {
      const docs = await NonProjectService.find({ _id: { $in: g.ids } })
        .sort({ createdAt: 1 })
        .select('_id')
        .lean();
      const keepId = docs[0]?._id;
      const deactivateIds = docs.slice(1).map((d) => d._id);
      if (!keepId || deactivateIds.length === 0) continue;
      await NonProjectService.updateMany(
        { _id: { $in: deactivateIds } },
        { $set: { isActive: false } }
      );
    }

    const indexes = await NonProjectService.collection.indexes();
    const targetKey = {
      volunteerId: 1,
      serviceDate: 1,
      serviceType: 1,
      duration: 1,
      description: 1
    };
    const hasDesiredIndex = indexes.some((idx) => {
      if (!idx.key) return false;
      const sameKey =
        idx.key.volunteerId === targetKey.volunteerId &&
        idx.key.serviceDate === targetKey.serviceDate &&
        idx.key.serviceType === targetKey.serviceType &&
        idx.key.duration === targetKey.duration &&
        idx.key.description === targetKey.description;
      return sameKey && idx.unique === true && idx.partialFilterExpression?.isActive === true;
    });

    if (!hasDesiredIndex) {
      const conflicting = indexes.filter((idx) => {
        if (!idx.key) return false;
        return (
          idx.key.volunteerId === targetKey.volunteerId &&
          idx.key.serviceDate === targetKey.serviceDate &&
          idx.key.serviceType === targetKey.serviceType &&
          idx.key.duration === targetKey.duration &&
          idx.key.description === targetKey.description
        );
      });
      for (const idx of conflicting) {
        await NonProjectService.collection.dropIndex(idx.name);
        console.log(`Dropped conflicting service index: ${idx.name}`);
      }

      await NonProjectService.collection.createIndex(
        targetKey,
        {
          unique: true,
          partialFilterExpression: { isActive: true }
        }
      );
      console.log('Created unique partial index for active service dedupe.');
    } else {
      console.log('Desired active service dedupe index already exists.');
    }
  } finally {
    await mongoose.connection.close();
  }
}

dedupeServiceRecords()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('migrate-dedupe-service-records failed:', error);
    process.exit(1);
  });
