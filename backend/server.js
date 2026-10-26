require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const app = express();
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/games', require('./routes/games'));
app.use('/api/admin', require('./routes/admin'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

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
    const adminExists = await User.findOne({ email: process.env.ADMIN_EMAIL });
    if (!adminExists) {
        await User.create({
            username: 'admin',
            email: process.env.ADMIN_EMAIL,
            password: process.env.ADMIN_PASSWORD,
            role: 'admin',
            balance: 999999,
            status: 'active',
        });
        console.log('✅ Admin user created:', process.env.ADMIN_EMAIL);
    }

    // Seed games
    const gameCount = await GameConfig.countDocuments();
    if (gameCount === 0) {
        await GameConfig.insertMany([
            { slug: 'slots', name: 'Lucky Slots', category: 'slots', rtp: 95, minBet: 10, maxBet: 50000, isFeatured: true, order: 1, description: 'Classic 3-reel slot machine with wild multipliers', image: '/games/slots.png', jackpotAmount: 500000 },
            { slug: 'crash', name: 'Crash', category: 'crash', rtp: 95, minBet: 10, maxBet: 50000, isFeatured: true, order: 2, description: 'Watch the multiplier rise and cashout before it crashes!', image: '/games/crash.png' },
            { slug: 'jackpot', name: 'Mega Jackpot', category: 'jackpot', rtp: 92, minBet: 50, maxBet: 10000, isFeatured: true, order: 3, description: 'Win the progressive jackpot', image: '/games/jackpot.png', jackpotAmount: 1000000 },
            { slug: 'teen-patti', name: 'Teen Patti', category: 'cards', rtp: 95, minBet: 20, maxBet: 50000, isFeatured: true, order: 4, description: 'The classic South Asian card game', image: '/games/teen-patti.png' },
            { slug: 'rummy', name: 'Rummy', category: 'cards', rtp: 95, minBet: 20, maxBet: 50000, isFeatured: false, order: 5, description: 'Classic Rummy card game', image: '/games/rummy.png' },
            { slug: 'dice', name: 'Dice', category: 'dice', rtp: 97, minBet: 10, maxBet: 50000, isFeatured: false, order: 6, description: 'Predict the dice roll over/under', image: '/games/dice.png' },
            { slug: 'color', name: 'Color Prediction', category: 'prediction', rtp: 95, minBet: 10, maxBet: 20000, isFeatured: true, order: 7, description: 'Predict the next color and win big!', image: '/games/color.png' },
        ]);
        console.log('✅ Games seeded');
    }

    // Seed bonuses
    const bonusCount = await Bonus.countDocuments();
    if (bonusCount === 0) {
        await Bonus.insertMany([
            { title: '🎉 Welcome Bonus', description: 'Get 100 PKR free on registration + 100% deposit bonus', type: 'welcome', amount: 100, percentage: 100, maxAmount: 5000, minDeposit: 500, isActive: true },
            { title: '💰 First Deposit Bonus', description: '200% bonus on your first deposit up to 10,000 PKR', type: 'deposit', percentage: 200, maxAmount: 10000, minDeposit: 500, isActive: true },
            { title: '🔄 Daily Reload Bonus', description: '20% daily reload bonus every day', type: 'daily', percentage: 20, maxAmount: 2000, minDeposit: 200, isActive: true },
            { title: '🏆 VIP Weekly Bonus', description: 'VIP players get 50% bonus every week', type: 'weekly', percentage: 50, maxAmount: 20000, minDeposit: 1000, isActive: true },
            { title: '🎰 Lucky Draw', description: 'Win up to 500,000 PKR in our weekly lucky draw!', type: 'lucky_draw', amount: 500000, isActive: true },
            { title: '👥 Refer & Earn', description: 'Earn 50 PKR for every friend you refer', type: 'referral', amount: 50, isActive: true },
        ]);
        console.log('✅ Bonuses seeded');
    }
}

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        console.log('✅ MongoDB connected');
        await seedDatabase();
        app.listen(PORT, () => console.log(`🚀 LuckHub API running on port ${PORT}`));
    })
    .catch(err => {
        console.error('❌ MongoDB connection failed:', err.message);
        process.exit(1);
    });
