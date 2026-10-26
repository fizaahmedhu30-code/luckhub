const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Bet = require('../models/Bet');
const Bonus = require('../models/Bonus');
const GameConfig = require('../models/GameConfig');
const { protect, adminOnly } = require('../middleware/auth');

const guard = [protect, adminOnly];

// GET /api/admin/stats - Dashboard KPIs
router.get('/stats', guard, async (req, res) => {
    try {
        const [totalUsers, activeUsers, bannedUsers, totalDeposits, pendingDeposits, totalWithdrawals, pendingWithdrawals, totalBets, totalRevenue] = await Promise.all([
            User.countDocuments({ role: 'user' }),
            User.countDocuments({ role: 'user', status: 'active' }),
            User.countDocuments({ status: 'banned' }),
            Transaction.aggregate([{ $match: { type: 'deposit', status: 'completed' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
            Transaction.countDocuments({ type: 'deposit', status: 'pending' }),
            Transaction.aggregate([{ $match: { type: 'withdrawal', status: 'completed' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
            Transaction.countDocuments({ type: 'withdrawal', status: 'pending' }),
            Bet.countDocuments(),
            Bet.aggregate([{ $group: { _id: null, total: { $sum: { $subtract: ['$amount', '$payout'] } } } }]),
        ]);
        res.json({
            totalUsers, activeUsers, bannedUsers,
            totalDeposits: totalDeposits[0]?.total || 0,
            pendingDeposits,
            totalWithdrawals: totalWithdrawals[0]?.total || 0,
            pendingWithdrawals,
            totalBets,
            totalRevenue: totalRevenue[0]?.total || 0,
        });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/admin/users
router.get('/users', guard, async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '', status = '' } = req.query;
        const query = { role: 'user' };
        if (search) query.$or = [{ username: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }];
        if (status) query.status = status;
        const total = await User.countDocuments(query);
        const users = await User.find(query).select('-password').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit));
        res.json({ users, total, page: parseInt(page), pages: Math.ceil(total / limit) });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/admin/users/:id
router.get('/users/:id', guard, async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password').populate('referredBy', 'username email');
        if (!user) return res.status(404).json({ message: 'User not found' });
        const [bets, transactions] = await Promise.all([
            Bet.find({ user: user._id }).sort({ createdAt: -1 }).limit(20),
            Transaction.find({ user: user._id }).sort({ createdAt: -1 }).limit(20),
        ]);
        res.json({ user: user.toSafeObject(), bets, transactions });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// PATCH /api/admin/users/:id
router.patch('/users/:id', guard, async (req, res) => {
    try {
        const { status, balance, vipLevel, role } = req.body;
        const update = {};
        if (status) update.status = status;
        if (vipLevel !== undefined) update.vipLevel = vipLevel;
        if (role) update.role = role;
        if (balance !== undefined) update.balance = balance;
        const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select('-password');
        res.json({ user: user.toSafeObject() });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/admin/transactions
router.get('/transactions', guard, async (req, res) => {
    try {
        const { page = 1, limit = 20, type = '', status = '' } = req.query;
        const query = {};
        if (type) query.type = type;
        if (status) query.status = status;
        const total = await Transaction.countDocuments(query);
        const txs = await Transaction.find(query).populate('user', 'username email').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit));
        res.json({ transactions: txs, total, page: parseInt(page), pages: Math.ceil(total / limit) });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// PATCH /api/admin/transactions/:id/approve
router.patch('/transactions/:id/approve', guard, async (req, res) => {
    try {
        const tx = await Transaction.findById(req.params.id);
        if (!tx) return res.status(404).json({ message: 'Transaction not found' });
        tx.status = 'completed';
        tx.processedBy = req.user._id;
        tx.processedAt = new Date();
        await tx.save();
        if (tx.type === 'deposit') {
            const user = await User.findById(tx.user);
            user.balance += tx.amount;
            user.totalDeposit += tx.amount;
            tx.balanceAfter = user.balance;
            await user.save();
            await tx.save();
        }
        res.json({ transaction: tx });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// PATCH /api/admin/transactions/:id/reject
router.patch('/transactions/:id/reject', guard, async (req, res) => {
    try {
        const tx = await Transaction.findById(req.params.id);
        if (!tx) return res.status(404).json({ message: 'Not found' });
        tx.status = 'failed';
        tx.processedBy = req.user._id;
        tx.processedAt = new Date();
        await tx.save();
        if (tx.type === 'withdrawal') {
            // Refund balance on rejected withdrawal
            await User.findByIdAndUpdate(tx.user, { $inc: { balance: tx.amount } });
        }
        res.json({ transaction: tx });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/admin/games
router.get('/games', guard, async (req, res) => {
    const games = await GameConfig.find().sort({ order: 1 });
    res.json({ games });
});

// PATCH /api/admin/games/:id
router.patch('/games/:id', guard, async (req, res) => {
    try {
        const { isActive, rtp, minBet, maxBet, isFeatured } = req.body;
        const update = {};
        if (isActive !== undefined) update.isActive = isActive;
        if (rtp !== undefined) update.rtp = rtp;
        if (minBet !== undefined) update.minBet = minBet;
        if (maxBet !== undefined) update.maxBet = maxBet;
        if (isFeatured !== undefined) update.isFeatured = isFeatured;
        const game = await GameConfig.findByIdAndUpdate(req.params.id, update, { new: true });
        res.json({ game });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/admin/bonuses
router.get('/bonuses', guard, async (req, res) => {
    const bonuses = await Bonus.find().sort({ createdAt: -1 });
    res.json({ bonuses });
});

// POST /api/admin/bonuses
router.post('/bonuses', guard, async (req, res) => {
    try {
        const bonus = await Bonus.create(req.body);
        res.status(201).json({ bonus });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// PATCH /api/admin/bonuses/:id
router.patch('/bonuses/:id', guard, async (req, res) => {
    try {
        const bonus = await Bonus.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json({ bonus });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// DELETE /api/admin/bonuses/:id
router.delete('/bonuses/:id', guard, async (req, res) => {
    try {
        await Bonus.findByIdAndDelete(req.params.id);
        res.json({ message: 'Bonus deleted' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/admin/analytics/revenue
router.get('/analytics/revenue', guard, async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const revenue = await Bet.aggregate([
            { $match: { createdAt: { $gte: startDate } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: { $subtract: ['$amount', '$payout'] } }, bets: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);
        const deposits = await Transaction.aggregate([
            { $match: { type: 'deposit', status: 'completed', createdAt: { $gte: startDate } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, total: { $sum: '$amount' } } },
            { $sort: { _id: 1 } }
        ]);
        res.json({ revenue, deposits });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
