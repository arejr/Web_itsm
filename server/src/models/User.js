const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES } = require('../config/constants');

const userSchema = new mongoose.Schema(
  {
    employeeId: { type: String, trim: true, unique: true, sparse: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'employee', index: true },
    department: { type: String, trim: true, default: '' },
    // กลุ่มงานที่ดูแล เช่น Desktop Support / Application Support / Network
    group: { type: String, trim: true, default: '' },
    skill: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    contact: { type: String, trim: true, default: '' },
    company: { type: String, trim: true, default: 'สำนักงานใหญ่' },
    orgCode: { type: String, trim: true, default: '' },
    active: { type: Boolean, default: true },
    lastLoginAt: { type: Date }
  },
  { timestamps: true }
);

userSchema.virtual('initial').get(function () {
  return (this.name || '?').trim().charAt(0).toUpperCase();
});

userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model('User', userSchema);
