const mongoose = require('mongoose');

const betSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    game: { type: String, required: true, enum: ['slots', 'crash', 'jackpot', 'teen-patti', 'rummy', 'dice', 'color'] },
    amount: { type: Number, required: true, min: 0 },
    multiplier: { type: Number, default: 0 },
    result: { type: String, enum: ['win', 'lose', 'pending'], default: 'pending' },
    payout: { type: Number, default: 0 },
    gameData: { type: mongoose.Schema.Types.Mixed, default: {} },
    balanceBefore: { type: Number, default: 0 },
    balanceAfter: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Bet', betSchema);
