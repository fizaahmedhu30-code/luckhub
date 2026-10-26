const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { protect } = require('../middleware/auth');

// Payment gateway numbers for Bangladesh deposit
const BD_PAYMENT_ACCOUNTS = {
    bkash: { type: 'Personal', number: '01712345678', instructions: 'Send Money to our bKash Personal Number and enter Transaction ID (TrxID) below.' },
    nagad: { type: 'Personal', number: '01812345678', instructions: 'Send Money to our Nagad Personal Number and enter Transaction ID (TrxID) below.' },
    rocket: { type: 'Personal', number: '01912345678-9', instructions: 'Send Money to our Rocket Personal Number and enter Transaction ID (TrxID) below.' },
    upay: { type: 'Personal', number: '01612345678', instructions: 'Send Money to our Upay Personal Number and enter Transaction ID (TrxID) below.' },
};

// GET /api/wallet/methods
router.get('/methods', (req, res) => {
    res.json({ currency: 'BDT', methods: BD_PAYMENT_ACCOUNTS });
});

// GET /api/wallet/balance
router.get('/balance', protect, async (req, res) => {
    const user = await User.findById(req.user._id).select('balance bonusBalance currency');
    res.json(user);
});

// POST /api/wallet/deposit
router.post('/deposit', protect, async (req, res) => {
    try {
        const { amount, method, accountDetails, screenshot, reference } = req.body;
        const depositAmount = parseFloat(amount);
        if (!depositAmount || depositAmount < 100) return res.status(400).json({ message: 'Minimum deposit is 100 BDT' });
        const user = await User.findById(req.user._id);
        const tx = await Transaction.create({
            user: user._id,
            type: 'deposit',
            amount: depositAmount,
            currency: user.currency || 'BDT',
            status: 'pending',
            method: method || 'bkash',
            reference: reference || '',
            balanceBefore: user.balance,
            balanceAfter: user.balance,
            screenshot: screenshot || '',
            accountDetails: accountDetails || {},
        });
        res.status(201).json({ message: 'Deposit request submitted successfully. Awaiting verification.', transaction: tx });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST /api/wallet/withdraw
router.post('/withdraw', protect, async (req, res) => {
    try {
        const { amount, method, accountDetails } = req.body;
        const withdrawAmount = parseFloat(amount);
        const user = await User.findById(req.user._id);
        if (!withdrawAmount || withdrawAmount < 200) return res.status(400).json({ message: 'Minimum withdrawal is 200 BDT' });
        if (user.balance < withdrawAmount) return res.status(400).json({ message: 'Insufficient balance' });
        
        user.balance -= withdrawAmount;
        user.totalWithdraw = (user.totalWithdraw || 0) + withdrawAmount;
        await user.save();

        const tx = await Transaction.create({
            user: user._id,
            type: 'withdrawal',
            amount: withdrawAmount,
            currency: user.currency || 'BDT',
            status: 'pending',
            method: method || 'bkash',
            balanceBefore: user.balance + withdrawAmount,
            balanceAfter: user.balance,
            accountDetails: accountDetails || {},
        });
        res.status(201).json({ message: 'Withdrawal request submitted successfully.', transaction: tx });
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
