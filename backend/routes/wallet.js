const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { protect } = require('../middleware/auth');

// GET /api/wallet/balance
router.get('/balance', protect, async (req, res) => {
    const user = await User.findById(req.user._id).select('balance bonusBalance currency');
    res.json(user);
});

// POST /api/wallet/deposit
router.post('/deposit', protect, async (req, res) => {
    try {
        const { amount, method, accountDetails, screenshot } = req.body;
        if (!amount || amount < 100) return res.status(400).json({ message: 'Minimum deposit is 100' });
        const user = await User.findById(req.user._id);
        const tx = await Transaction.create({
            user: user._id,
            type: 'deposit',
            amount,
            currency: user.currency,
            status: 'pending',
            method: method || 'easypaisa',
            balanceBefore: user.balance,
            balanceAfter: user.balance,
            screenshot: screenshot || '',
            accountDetails: accountDetails || {},
        });
        res.status(201).json({ message: 'Deposit request submitted. Awaiting approval.', transaction: tx });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST /api/wallet/withdraw
router.post('/withdraw', protect, async (req, res) => {
    try {
        const { amount, method, accountDetails } = req.body;
        const user = await User.findById(req.user._id);
        if (!amount || amount < 200) return res.status(400).json({ message: 'Minimum withdrawal is 200' });
        if (user.balance < amount) return res.status(400).json({ message: 'Insufficient balance' });
        user.balance -= amount;
        await user.save();
        const tx = await Transaction.create({
            user: user._id,
            type: 'withdrawal',
            amount,
            currency: user.currency,
            status: 'pending',
            method: method || 'easypaisa',
            balanceBefore: user.balance + amount,
            balanceAfter: user.balance,
            accountDetails: accountDetails || {},
        });
        res.status(201).json({ message: 'Withdrawal request submitted.', transaction: tx });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET /api/wallet/transactions
router.get('/transactions', protect, async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const total = await Transaction.countDocuments({ user: req.user._id });
    const txs = await Transaction.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));
    res.json({ transactions: txs, total, page: parseInt(page), pages: Math.ceil(total / limit) });
});

module.exports = router;
