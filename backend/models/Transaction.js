const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true, enum: ['deposit', 'withdrawal', 'bonus', 'referral', 'bet', 'win', 'adjustment'] },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'PKR' },
    status: { type: String, default: 'pending', enum: ['pending', 'completed', 'failed', 'cancelled'] },
    method: { type: String, default: '', enum: ['', 'easypaisa', 'jazzcash', 'bank', 'system'] },
    reference: { type: String, default: '' },
    note: { type: String, default: '' },
    balanceBefore: { type: Number, default: 0 },
    balanceAfter: { type: Number, default: 0 },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    processedAt: { type: Date, default: null },
    screenshot: { type: String, default: '' },
    accountDetails: {
        accountName: { type: String, default: '' },
        accountNumber: { type: String, default: '' },
        bankName: { type: String, default: '' },
    }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
