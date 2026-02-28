import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const accountSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, '邮箱是必需的'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, '请输入有效的邮箱地址']
    },
    passwordHash: {
      type: String,
      required: [true, '密码哈希是必需的'],
      select: false
    },
    name: {
      type: String,
      required: [true, '姓名是必需的'],
      trim: true,
      minlength: [2, '姓名至少2个字符'],
      maxlength: [100, '姓名最多100个字符']
    },
    role: {
      type: String,
      enum: ['user', 'b_admin', 'a_admin', 'admin'],
      default: 'user'
    },
    volunteerId: {
      type: String,
      trim: true,
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastLoginAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

accountSchema.index({ email: 1 }, { unique: true });
accountSchema.index({ volunteerId: 1 });
accountSchema.index({ role: 1, isActive: 1 });

accountSchema.statics.hashPassword = async function hashPassword(password) {
  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
  return bcrypt.hash(password, saltRounds);
};

accountSchema.methods.verifyPassword = async function verifyPassword(plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

export default mongoose.model('Account', accountSchema);
