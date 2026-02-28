import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Volunteer from '../src/models/Volunteer.js';
import NonProjectService from '../src/models/NonProjectService.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/volunteer_tracker';
const APPLY = process.argv.includes('--apply');
const DEPRECATED_TYPES = ['项目培训', '非项目培训', '受训', '社区服务'];

async function removeDeprecatedServiceTypes() {
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000
  });

  try {
    const volunteersAffected = await Volunteer.countDocuments({
      services: { $in: DEPRECATED_TYPES }
    });
    const activeServicesToDeactivate = await NonProjectService.countDocuments({
      isActive: true,
      serviceType: { $in: DEPRECATED_TYPES }
    });

    console.log(`Volunteers with deprecated directions: ${volunteersAffected}`);
    console.log(`Active non-project service records to deactivate: ${activeServicesToDeactivate}`);

    if (!APPLY) {
      console.log('Dry run only. Re-run with --apply to clean database records.');
      return;
    }

    if (volunteersAffected > 0) {
      await Volunteer.updateMany(
        { services: { $in: DEPRECATED_TYPES } },
        { $pull: { services: { $in: DEPRECATED_TYPES } } }
      );
    }

    if (activeServicesToDeactivate > 0) {
      await NonProjectService.updateMany(
        {
          isActive: true,
          serviceType: { $in: DEPRECATED_TYPES }
        },
        {
          $set: {
            isActive: false,
            indexedIsActive: false
          }
        }
      );
    }

    const volunteersRemaining = await Volunteer.countDocuments({
      services: { $in: DEPRECATED_TYPES }
    });
    const activeServicesRemaining = await NonProjectService.countDocuments({
      isActive: true,
      serviceType: { $in: DEPRECATED_TYPES }
    });

    console.log(`Remaining volunteers with deprecated directions: ${volunteersRemaining}`);
    console.log(`Remaining active service records with deprecated types: ${activeServicesRemaining}`);
  } finally {
    await mongoose.connection.close();
  }
}

removeDeprecatedServiceTypes()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('migrate-remove-deprecated-service-types failed:', error);
    process.exit(1);
  });
