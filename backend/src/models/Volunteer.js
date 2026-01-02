const mongoose = require('mongoose');

const volunteerSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    match: /^VM-\d{4}$/
  },
  chineseName: {
    type: String,
    required: true,
    trim: true
  },
  englishName: {
    type: String,
    trim: true
  },
  avatar: {
    type: String,
    default: '/assets/images/avatars/default.jpg'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending'],
    required: true,
    default: 'active'
  },
  region: {
    type: String,
    required: true,
    index: true
  },
  services: [{
    type: String,
    enum: ['translation', 'proofreading', 'management', 'technical', 'other']
  }],
  totalHours: {
    type: Number,
    default: 0,
    min: 0
  },
  serviceCount: {
    type: Number,
    default: 0,
    min: 0
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  joinDate: {
    type: Date,
    default: Date.now
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  description: {
    type: String,
    trim: true
  },
  timezone: {
    type: String,
    default: 'Asia/Shanghai'
  },
  currentLocation: {
    country: String,
    city: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  serviceRecords: [{
    date: Date,
    type: {
      type: String,
      enum: ['community', 'training', 'organization', 'technical', 'admin', 'other']
    },
    hours: Number,
    description: String,
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'rejected'],
      default: 'pending'
    },
    attachments: [String]
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// 索引
volunteerSchema.index({ region: 1, status: 1 });
volunteerSchema.index({ services: 1 });

// 虚拟字段
volunteerSchema.virtual('fullName').get(function() {
  if (this.englishName && this.chineseName) {
    return `${this.chineseName} (${this.englishName})`;
  }
  return this.englishName || this.chineseName;
});

module.exports = mongoose.model('Volunteer', volunteerSchema);
