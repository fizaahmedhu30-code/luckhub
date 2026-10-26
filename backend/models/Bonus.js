const mongoose = require('mongoose');

const bonusSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, default: '' },
    type: { type: String, enum: ['welcome', 'deposit', 'referral', 'daily', 'weekly', 'lucky_draw', 'free_spins', 'vip'], default: 'deposit' },
    amount: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    maxAmount: { type: Number, default: 0 },
    minDeposit: { type: Number, default: 0 },
    wagerRequirement: { type: Number, default: 1 },
    freeSpins: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    expiresAt: { type: Date, default: null },
    claimedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    code: { type: String, default: '' },
    image: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Bonus', bonusSchema);
