const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Bet = require('../models/Bet');
const GameConfig = require('../models/GameConfig');
const { protect } = require('../middleware/auth');

// Helper: House edge RNG
function houseRNG(rtp) {
    return Math.random() * 100 < rtp;
}

// GET /api/games - list all games
router.get('/', async (req, res) => {
    try {
        const games = await GameConfig.find({ isActive: true }).sort({ order: 1, isFeatured: -1 });
        res.json({ games });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 1. SLOTS
// POST /api/games/slots/spin
router.post('/slots/spin', protect, async (req, res) => {
    try {
        const { betAmount } = req.body;
        const amount = Math.max(10, parseInt(betAmount) || 10);
        const user = await User.findById(req.user._id);
        if (user.balance < amount) return res.status(400).json({ message: 'Insufficient balance' });
        const gameConfig = await GameConfig.findOne({ slug: 'slots' });
        const rtp = gameConfig?.rtp || 95;

        const symbols = ['🍒', '🍋', '🍊', '🍇', '⭐', '💎', '7️⃣', '🔔'];
        const reels = [
            symbols[Math.floor(Math.random() * symbols.length)],
            symbols[Math.floor(Math.random() * symbols.length)],
            symbols[Math.floor(Math.random() * symbols.length)],
        ];

        const isWin = houseRNG(rtp);
        let finalReels = reels;
        let multiplier = 0;
        let payout = 0;

        if (isWin) {
            const winSymbol = symbols[Math.floor(Math.random() * symbols.length)];
            const winCount = Math.random() < 0.6 ? 3 : 2;
            finalReels = winCount === 3
                ? [winSymbol, winSymbol, winSymbol]
                : [winSymbol, winSymbol, symbols[Math.floor(Math.random() * symbols.length)]];
            const payouts = { '💎': 50, '7️⃣': 25, '⭐': 15, '🔔': 10, '🍇': 5, '🍊': 4, '🍋': 3, '🍒': 2 };
            multiplier = (payouts[winSymbol] || 2) * (winCount === 3 ? 1 : 0.5);
            payout = Math.round(amount * multiplier);
        }

        const balanceBefore = user.balance;
        user.balance = user.balance - amount + payout;
        user.totalBets += amount;
        if (payout > 0) user.totalWins += payout;
        await user.save();

        if (gameConfig) {
            gameConfig.totalBets += 1;
            gameConfig.totalRevenue += (amount - payout);
            await gameConfig.save();
        }

        const bet = await Bet.create({
            user: user._id, game: 'slots', amount,
            multiplier, result: isWin ? 'win' : 'lose', payout,
            gameData: { reels: finalReels },
            balanceBefore, balanceAfter: user.balance
        });

        res.json({ reels: finalReels, isWin, multiplier, payout, balance: user.balance, betId: bet._id });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 2. CRASH (Aviator)
// POST /api/games/crash/start
router.post('/crash/start', protect, async (req, res) => {
    try {
        const { betAmount } = req.body;
        const amount = Math.max(10, parseInt(betAmount) || 10);
        const user = await User.findById(req.user._id);
        if (user.balance < amount) return res.status(400).json({ message: 'Insufficient balance' });
        const gameConfig = await GameConfig.findOne({ slug: 'crash' });
        const rtp = gameConfig?.rtp || 95;

        // Provably fair crash point
        const e = 2 ** 32;
        const rand = Math.random() * e;
        let crashPoint = Math.floor(e / (e - rand) * 100) / 100;
        if (!houseRNG(rtp)) crashPoint = Math.max(1.0, crashPoint * 0.35);
        crashPoint = Math.max(1.0, Math.min(crashPoint, 200));

        user.balance -= amount;
        user.totalBets += amount;
        await user.save();

        const bet = await Bet.create({
            user: user._id, game: 'crash', amount,
            result: 'pending', gameData: { crashPoint },
            balanceBefore: user.balance + amount, balanceAfter: user.balance
        });

        res.json({ betId: bet._id, crashPoint, balance: user.balance });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST /api/games/crash/cashout
router.post('/crash/cashout', protect, async (req, res) => {
    try {
        const { betId, cashoutMultiplier } = req.body;
        const bet = await Bet.findById(betId);
        if (!bet || bet.user.toString() !== req.user._id.toString()) return res.status(404).json({ message: 'Bet not found' });
        if (bet.result !== 'pending') return res.status(400).json({ message: 'Bet already settled' });

        const crashPoint = bet.gameData.crashPoint;
        const multiplier = parseFloat(cashoutMultiplier) || 1.0;
        const isWin = multiplier <= crashPoint;
        const payout = isWin ? Math.round(bet.amount * multiplier) : 0;
        const user = await User.findById(req.user._id);

        bet.result = isWin ? 'win' : 'lose';
        bet.multiplier = multiplier;
        bet.payout = payout;
        bet.balanceAfter = user.balance + payout;
        await bet.save();

        user.balance += payout;
        if (payout > 0) user.totalWins += payout;
        await user.save();

        res.json({ isWin, payout, crashPoint, balance: user.balance });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 3. DICE
// POST /api/games/dice/roll
router.post('/dice/roll', protect, async (req, res) => {
    try {
        const { betAmount, prediction, target } = req.body;
        const amount = Math.max(10, parseInt(betAmount) || 10);
        const user = await User.findById(req.user._id);
        if (user.balance < amount) return res.status(400).json({ message: 'Insufficient balance' });
        const gameConfig = await GameConfig.findOne({ slug: 'dice' });
        const rtp = gameConfig?.rtp || 95;

        const rollTarget = parseInt(target) || 50;
        const roll = Math.floor(Math.random() * 100) + 1;
        let isWin = false;
        let multiplier = 0;

        if (prediction === 'over' && roll > rollTarget) {
            isWin = true;
            multiplier = parseFloat((98 / (100 - rollTarget)).toFixed(2));
        } else if (prediction === 'under' && roll < rollTarget) {
            isWin = true;
            multiplier = parseFloat((98 / rollTarget).toFixed(2));
        }

        if (!houseRNG(rtp)) { isWin = false; multiplier = 0; }

        const payout = isWin ? Math.round(amount * multiplier) : 0;
        user.balance = user.balance - amount + payout;
        user.totalBets += amount;
        if (payout > 0) user.totalWins += payout;
        await user.save();

        await Bet.create({
            user: user._id, game: 'dice', amount,
            multiplier, result: isWin ? 'win' : 'lose', payout,
            gameData: { roll, prediction, target: rollTarget },
            balanceBefore: user.balance + amount - payout, balanceAfter: user.balance
        });

        res.json({ roll, isWin, multiplier, payout, balance: user.balance });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 4. COLOR PREDICTION
// POST /api/games/color/predict
router.post('/color/predict', protect, async (req, res) => {
    try {
        const { betAmount, color } = req.body;
        const amount = Math.max(10, parseInt(betAmount) || 10);
        const user = await User.findById(req.user._id);
        if (user.balance < amount) return res.status(400).json({ message: 'Insufficient balance' });
        const gameConfig = await GameConfig.findOne({ slug: 'color' });
        const rtp = gameConfig?.rtp || 95;

        const colors = ['red', 'green', 'violet'];
        const weights = [45, 45, 10];
        let rand = Math.random() * 100;
        let result = 'red';
        let cumul = 0;
        for (let i = 0; i < colors.length; i++) {
            cumul += weights[i];
            if (rand < cumul) { result = colors[i]; break; }
        }

        const multipliers = { red: 2, green: 2, violet: 9 };
        let isWin = (color === result);
        if (!houseRNG(rtp)) isWin = false;

        const multiplier = isWin ? multipliers[result] : 0;
        const payout = isWin ? Math.round(amount * multiplier) : 0;
        user.balance = user.balance - amount + payout;
        user.totalBets += amount;
        if (payout > 0) user.totalWins += payout;
        await user.save();

        await Bet.create({
            user: user._id, game: 'color', amount,
            multiplier, result: isWin ? 'win' : 'lose', payout,
            gameData: { predicted: color, resultColor: result },
            balanceBefore: user.balance + amount - payout, balanceAfter: user.balance
        });

        res.json({ result, isWin, multiplier, payout, balance: user.balance });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 5. TEEN PATTI
// POST /api/games/teen-patti/play
router.post('/teen-patti/play', protect, async (req, res) => {
    try {
        const { betAmount } = req.body;
        const amount = Math.max(20, parseInt(betAmount) || 20);
        const user = await User.findById(req.user._id);
        if (user.balance < amount) return res.status(400).json({ message: 'Insufficient balance' });
        const gameConfig = await GameConfig.findOne({ slug: 'teen-patti' });
        const rtp = gameConfig?.rtp || 95;

        const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        const suits = ['♠', '♥', '♦', '♣'];
        const getRandomCard = () => ({
            rank: ranks[Math.floor(Math.random() * ranks.length)],
            suit: suits[Math.floor(Math.random() * suits.length)]
        });

        const playerCards = [getRandomCard(), getRandomCard(), getRandomCard()];
        const dealerCards = [getRandomCard(), getRandomCard(), getRandomCard()];

        const isWin = houseRNG(rtp);
        const multiplier = isWin ? 1.95 : 0;
        const payout = isWin ? Math.round(amount * multiplier) : 0;

        user.balance = user.balance - amount + payout;
        user.totalBets += amount;
        if (payout > 0) user.totalWins += payout;
        await user.save();

        await Bet.create({
            user: user._id, game: 'teen-patti', amount,
            multiplier, result: isWin ? 'win' : 'lose', payout,
            gameData: { playerCards, dealerCards },
            balanceBefore: user.balance + amount - payout, balanceAfter: user.balance
        });

        res.json({ playerCards, dealerCards, isWin, multiplier, payout, balance: user.balance });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 6. RUMMY
// POST /api/games/rummy/play
router.post('/rummy/play', protect, async (req, res) => {
    try {
        const { betAmount } = req.body;
        const amount = Math.max(20, parseInt(betAmount) || 20);
        const user = await User.findById(req.user._id);
        if (user.balance < amount) return res.status(400).json({ message: 'Insufficient balance' });
        const gameConfig = await GameConfig.findOne({ slug: 'rummy' });
        const rtp = gameConfig?.rtp || 95;

        const isWin = houseRNG(rtp);
        const multiplier = isWin ? 2.0 : 0;
        const payout = isWin ? Math.round(amount * multiplier) : 0;

        user.balance = user.balance - amount + payout;
        user.totalBets += amount;
        if (payout > 0) user.totalWins += payout;
        await user.save();

        await Bet.create({
            user: user._id, game: 'rummy', amount,
            multiplier, result: isWin ? 'win' : 'lose', payout,
            gameData: { isWin },
            balanceBefore: user.balance + amount - payout, balanceAfter: user.balance
        });

        res.json({ isWin, multiplier, payout, balance: user.balance });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 7. MEGA JACKPOT
// POST /api/games/jackpot/spin
router.post('/jackpot/spin', protect, async (req, res) => {
    try {
        const { betAmount } = req.body;
        const amount = Math.max(50, parseInt(betAmount) || 50);
        const user = await User.findById(req.user._id);
        if (user.balance < amount) return res.status(400).json({ message: 'Insufficient balance' });
        const gameConfig = await GameConfig.findOne({ slug: 'jackpot' });
        const rtp = gameConfig?.rtp || 92;

        const slices = [
            { label: 'Try Again', mult: 0, weight: 45 },
            { label: '2x BDT', mult: 2, weight: 25 },
            { label: '5x BDT', mult: 5, weight: 15 },
            { label: '10x BDT', mult: 10, weight: 9 },
            { label: '50x BDT', mult: 50, weight: 5 },
            { label: '🏆 MEGA JACKPOT', mult: 200, weight: 1 },
        ];

        let rand = Math.random() * 100;
        let selectedSlice = slices[0];
        let cumul = 0;
        for (const s of slices) {
            cumul += s.weight;
            if (rand < cumul) { selectedSlice = s; break; }
        }

        let isWin = selectedSlice.mult > 0;
        if (!houseRNG(rtp)) { isWin = false; selectedSlice = slices[0]; }

        const multiplier = isWin ? selectedSlice.mult : 0;
        const payout = isWin ? Math.round(amount * multiplier) : 0;

        user.balance = user.balance - amount + payout;
        user.totalBets += amount;
        if (payout > 0) user.totalWins += payout;
        await user.save();

        await Bet.create({
            user: user._id, game: 'jackpot', amount,
            multiplier, result: isWin ? 'win' : 'lose', payout,
            gameData: { slice: selectedSlice.label },
            balanceBefore: user.balance + amount - payout, balanceAfter: user.balance
        });

        res.json({ slice: selectedSlice.label, isWin, multiplier, payout, balance: user.balance });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET /api/games/bets - user bet history
router.get('/bets', protect, async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const total = await Bet.countDocuments({ user: req.user._id });
    const bets = await Bet.find({ user: req.user._id }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit));
    res.json({ bets, total, page: parseInt(page) });
});

module.exports = router;
