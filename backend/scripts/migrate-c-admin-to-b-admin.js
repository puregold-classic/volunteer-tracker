import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/volunteer_demo';
const APPLY_MODE = process.argv.includes('--apply');

const targets = [
  {
    label: 'volunteers.role',
    collection: 'volunteers',
    filter: { role: 'c_admin' },
    update: { $set: { role: 'b_admin' } }
  },
  {
    label: 'serviceapplications.submittedBy.role',
    collection: 'serviceapplications',
    filter: { 'submittedBy.role': 'c_admin' },
    update: { $set: { 'submittedBy.role': 'b_admin' } }
  },
  {
    label: 'auditlogs.operator.role',
    collection: 'auditlogs',
    filter: { 'operator.role': 'c_admin' },
    update: { $set: { 'operator.role': 'b_admin' } }
  },
  {
    label: 'auditlogs.submitter.role',
    collection: 'auditlogs',
    filter: { 'submitter.role': 'c_admin' },
    update: { $set: { 'submitter.role': 'b_admin' } }
  }
];

async function run() {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });

    console.log(`Connected to MongoDB: ${mongoose.connection.db.databaseName}`);
    console.log(`Mode: ${APPLY_MODE ? 'APPLY' : 'DRY RUN'}`);

    let totalMatched = 0;
    let totalModified = 0;

    for (const target of targets) {
      const collection = mongoose.connection.collection(target.collection);
      const matched = await collection.countDocuments(target.filter);
      totalMatched += matched;

      if (!APPLY_MODE) {
        console.log(`[DRY RUN] ${target.label}: ${matched} docs will be updated`);
        continue;
      }

      const result = await collection.updateMany(target.filter, target.update);
      totalModified += result.modifiedCount || 0;
      console.log(
        `[APPLY] ${target.label}: matched=${result.matchedCount || 0}, modified=${result.modifiedCount || 0}`
      );
    }

    if (!APPLY_MODE) {
      console.log(`Dry run complete. Total documents requiring migration: ${totalMatched}`);
      console.log('Run with --apply to execute updates.');
      return;
    }

    console.log(`Migration complete. Total matched: ${totalMatched}, total modified: ${totalModified}`);

    let remaining = 0;
    for (const target of targets) {
      const collection = mongoose.connection.collection(target.collection);
      remaining += await collection.countDocuments(target.filter);
    }

    console.log(`Post-check: remaining c_admin references in target fields = ${remaining}`);
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
}

run();
