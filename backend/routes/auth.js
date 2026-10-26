const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { username, email, password, phone, referralCode, currency } = req.body;
        if (!username || !email || !password) return res.status(400).json({ message: 'All fields required' });
        const existing = await User.findOne({ $or: [{ email }, { username }] });
        if (existing) return res.status(400).json({ message: 'Username or email already taken' });

        const userData = { username, email, password, phone: phone || '', currency: currency || 'BDT' };

        // Handle referral
        if (referralCode) {
            const referrer = await User.findOne({ referralCode });
            if (referrer) {
                userData.referredBy = referrer._id;
            }
        }

        const user = await User.create(userData);

        // Give welcome bonus in BDT
        user.balance = 100;
        await user.save();

        // If referred, credit referrer
        if (userData.referredBy) {
            await User.findByIdAndUpdate(userData.referredBy, {
                $inc: { balance: 50, referralEarnings: 50, referralCount: 1 }
            });
        }

        const token = signToken(user._id);
        res.status(201).json({ token, user: user.toSafeObject() });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }
        if (user.status === 'banned') return res.status(403).json({ message: 'Account has been banned' });
        user.lastLogin = Date.now();
        await user.save();
        const token = signToken(user._id);
        res.json({ token, user: user.toSafeObject() });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET /api/auth/me
router.get('/me', protect, async (req, res) => {
    const user = await User.findById(req.user._id).select('-password');
    res.json({ user: user.toSafeObject() });
});

module.exports = router;
