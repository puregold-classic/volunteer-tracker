import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Account from '../src/models/Account.js';
import Volunteer from '../src/models/Volunteer.js';
import NonProjectService from '../src/models/NonProjectService.js';
import ServiceApplication from '../src/models/ServiceApplication.js';
import AuditLog from '../src/models/AuditLog.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/volunteer_tracker';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@12345';
const ADMIN_NAME = process.env.ADMIN_NAME || 'System Admin';

const run = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log(`Connected to MongoDB: ${MONGODB_URI}`);

    let admin = await Account.findOne({ email: ADMIN_EMAIL }).select('+passwordHash');
    if (!admin) {
      const passwordHash = await Account.hashPassword(ADMIN_PASSWORD);
      admin = await Account.create({
        email: ADMIN_EMAIL,
        passwordHash,
        name: ADMIN_NAME,
        role: 'admin',
        volunteerId: 'PG-0000',
        isActive: true
      });
      console.log(`Created system admin: ${ADMIN_EMAIL}`);
    } else {
      admin.role = 'admin';
      admin.volunteerId = 'PG-0000';
      admin.isActive = true;
      await admin.save();
      console.log(`Kept existing system admin: ${ADMIN_EMAIL}`);
    }

    const [volunteers, services, applications, audits, accounts] = await Promise.all([
      Volunteer.deleteMany({}),
      NonProjectService.deleteMany({}),
      ServiceApplication.deleteMany({}),
      AuditLog.deleteMany({}),
      Account.deleteMany({ _id: { $ne: admin._id } })
    ]);

    console.log('Reset done. Deleted records:');
    console.log(`- volunteers: ${volunteers.deletedCount}`);
    console.log(`- services: ${services.deletedCount}`);
    console.log(`- applications: ${applications.deletedCount}`);
    console.log(`- audits: ${audits.deletedCount}`);
    console.log(`- accounts: ${accounts.deletedCount}`);
    console.log(`System admin kept: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  } catch (error) {
    console.error('Reset failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

run();
