const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 20 },
  email: { type: String, required: true, unique: true, lowercase: true },
  phone: { type: String, default: '' },
  password: { type: String, required: true },
  balance: { type: Number, default: 0, min: 0 },
  bonusBalance: { type: Number, default: 0, min: 0 },
  totalDeposit: { type: Number, default: 0 },
  totalWithdraw: { type: Number, default: 0 },
  totalBets: { type: Number, default: 0 },
  totalWins: { type: Number, default: 0 },
  currency: { type: String, default: 'BDT', enum: ['BDT', 'USD', 'PKR', 'INR'] },
  role: { type: String, default: 'user', enum: ['user', 'agent', 'admin'] },
  status: { type: String, default: 'active', enum: ['active', 'banned', 'pending'] },
  vipLevel: { type: Number, default: 0, min: 0, max: 10 },
  vipPoints: { type: Number, default: 0 },
  referralCode: { type: String, unique: true, default: () => uuidv4().slice(0, 8).toUpperCase() },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  referralEarnings: { type: Number, default: 0 },
  referralCount: { type: Number, default: 0 },
  avatar: { type: String, default: '' },
  lastLogin: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now },
  isEmailVerified: { type: Boolean, default: false },
  kycStatus: { type: String, default: 'unverified', enum: ['unverified', 'pending', 'verified'] },
  withdrawPin: { type: String, default: '' },
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.withdrawPin;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
