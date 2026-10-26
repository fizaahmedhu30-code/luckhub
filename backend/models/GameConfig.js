const mongoose = require('mongoose');

const gameConfigSchema = new mongoose.Schema({
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    category: { type: String, enum: ['slots', 'crash', 'jackpot', 'cards', 'dice', 'prediction', 'live'], default: 'slots' },
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    rtp: { type: Number, default: 95, min: 50, max: 99 },
    minBet: { type: Number, default: 10 },
    maxBet: { type: Number, default: 10000 },
    jackpotAmount: { type: Number, default: 0 },
    totalBets: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    image: { type: String, default: '' },
    description: { type: String, default: '' },
    order: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('GameConfig', gameConfigSchema);
