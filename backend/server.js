require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/games', require('./routes/games'));
app.use('/api/admin', require('./routes/admin'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', country: 'BD', currency: 'BDT', time: new Date() }));

// 404 handler
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Internal server error' });
});

async function seedDatabase() {
    const User = require('./models/User');
    const GameConfig = require('./models/GameConfig');
    const Bonus = require('./models/Bonus');

    // Seed admin
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@luckhub.com';
    const adminExists = await User.findOne({ email: adminEmail });
    if (!adminExists) {
        await User.create({
            username: 'admin',
            email: adminEmail,
            password: process.env.ADMIN_PASSWORD || 'Admin@123456',
            role: 'admin',
            currency: 'BDT',
            balance: 999999,
            status: 'active',
        });
        console.log('✅ Admin user created:', adminEmail);
    }

    // Seed demo player
    const demoPlayer = await User.findOne({ email: 'player@luckhub.com' });
    if (!demoPlayer) {
        await User.create({
            username: 'demo_player',
            email: 'player@luckhub.com',
            password: 'Player@123456',
            phone: '01700000000',
            role: 'user',
            currency: 'BDT',
            balance: 5000,
            status: 'active',
        });
        console.log('✅ Demo player created: player@luckhub.com (password: Player@123456)');
    }

    // Seed games with BDT amounts
    const gameCount = await GameConfig.countDocuments();
    if (gameCount === 0) {
        await GameConfig.insertMany([
            { slug: 'slots', name: 'Lucky 777 Slots', category: 'slots', rtp: 95, minBet: 10, maxBet: 50000, isFeatured: true, order: 1, description: 'Classic 3-reel slot machine with huge wild multipliers', image: '🎰', jackpotAmount: 500000 },
            { slug: 'crash', name: 'Aviator Crash', category: 'crash', rtp: 95, minBet: 10, maxBet: 50000, isFeatured: true, order: 2, description: 'Watch the rocket fly and cashout before it crashes!', image: '🚀' },
            { slug: 'jackpot', name: 'Mega BDT Jackpot', category: 'jackpot', rtp: 92, minBet: 50, maxBet: 10000, isFeatured: true, order: 3, description: 'Spin the wheel for progressive ৳500,000 jackpot', image: '🏆', jackpotAmount: 500000 },
            { slug: 'teen-patti', name: 'Teen Patti 3-Card', category: 'cards', rtp: 95, minBet: 20, maxBet: 50000, isFeatured: true, order: 4, description: 'Popular South Asian 3-card poker game', image: '🃏' },
            { slug: 'rummy', name: 'Speed Rummy', category: 'cards', rtp: 95, minBet: 20, maxBet: 50000, isFeatured: false, order: 5, description: 'Fast-paced Indian/Bengali Rummy card showdown', image: '♠️' },
            { slug: 'dice', name: 'Crypto Dice', category: 'dice', rtp: 97, minBet: 10, maxBet: 50000, isFeatured: false, order: 6, description: 'Predict dice roll over or under for instant BDT', image: '🎲' },
            { slug: 'color', name: 'Color Prediction', category: 'prediction', rtp: 95, minBet: 10, maxBet: 20000, isFeatured: true, order: 7, description: 'Predict Red, Green, or Violet for up to 9x payout!', image: '🎨' },
        ]);
        console.log('✅ Games seeded');
    }

    // Seed bonuses
    const bonusCount = await Bonus.countDocuments();
    if (bonusCount === 0) {
        await Bonus.insertMany([
            { title: '🎉 Welcome Bonus', description: 'Get ৳100 BDT free on registration + 100% deposit bonus', type: 'welcome', amount: 100, percentage: 100, maxAmount: 5000, minDeposit: 500, isActive: true },
            { title: '💰 First Deposit Bonus', description: '200% bonus on your first deposit up to ৳10,000 BDT via bKash / Nagad', type: 'deposit', percentage: 200, maxAmount: 10000, minDeposit: 500, isActive: true },
            { title: '🔄 Daily Reload Bonus', description: '20% daily reload bonus every day up to ৳2,000 BDT', type: 'daily', percentage: 20, maxAmount: 2000, minDeposit: 200, isActive: true },
            { title: '🏆 VIP Weekly Bonus', description: 'VIP players get 50% bonus every week up to ৳20,000 BDT', type: 'weekly', percentage: 50, maxAmount: 20000, minDeposit: 1000, isActive: true },
            { title: '🎰 Lucky Draw', description: 'Win up to ৳500,000 BDT in our weekly lucky draw!', type: 'lucky_draw', amount: 500000, isActive: true },
            { title: '👥 Refer & Earn', description: 'Earn ৳50 BDT for every friend who signs up with your link', type: 'referral', amount: 50, isActive: true },
        ]);
        console.log('✅ Bonuses seeded');
    }
}

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/luckhub';

mongoose.connect(MONGODB_URI)
    .then(async () => {
        console.log('✅ MongoDB connected');
        await seedDatabase();
        app.listen(PORT, () => console.log(`🚀 LuckHub API running on port ${PORT}`));
    })
    .catch(err => {
        console.error('❌ MongoDB connection failed:', err.message);
        process.exit(1);
    });
