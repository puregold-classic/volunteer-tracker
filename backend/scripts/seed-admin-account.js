import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Account from '../src/models/Account.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/volunteer_demo';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_NAME = process.env.ADMIN_NAME || 'System Admin';
const ADMIN_ROLE = process.env.ADMIN_ROLE || 'admin';
const ADMIN_VOLUNTEER_ID = process.env.ADMIN_VOLUNTEER_ID || 'PG-0000';

async function seedAdminAccount() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('Missing required env vars: ADMIN_EMAIL and ADMIN_PASSWORD');
    process.exit(1);
  }

  if (ADMIN_PASSWORD.length < 8) {
    console.error('ADMIN_PASSWORD must be at least 8 characters');
    process.exit(1);
  }

  const allowedRoles = ['b_admin', 'a_admin', 'admin'];
  if (!allowedRoles.includes(ADMIN_ROLE)) {
    console.error(`ADMIN_ROLE must be one of: ${allowedRoles.join(', ')}`);
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });

    const existing = await Account.findOne({ email: ADMIN_EMAIL.toLowerCase() });
    if (existing) {
      await Account.updateOne(
        { _id: existing._id },
        {
          $set: {
            name: ADMIN_NAME,
            role: ADMIN_ROLE,
            volunteerId: ADMIN_VOLUNTEER_ID,
            isActive: true
          }
        }
      );
      console.log(`Admin account already exists and has been updated: ${existing.email}`);
      process.exit(0);
    }

    const passwordHash = await Account.hashPassword(ADMIN_PASSWORD);
    const created = await Account.create({
      email: ADMIN_EMAIL,
      passwordHash,
      name: ADMIN_NAME,
      role: ADMIN_ROLE,
      volunteerId: ADMIN_VOLUNTEER_ID
    });

    console.log('Admin account created successfully');
    console.log(`id=${created._id} email=${created.email} role=${created.role}`);
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed admin account:', error.message);
    process.exit(1);
  }
}

seedAdminAccount();
