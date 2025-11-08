module.exports = {
    AES_SECRET: process.env.AES_SECRET || '6e74726f6d343836326e74726f6d34383632',
    JWT_SECRET: process.env.JWT_SECRET || '6e74726f6d343836325f6a77745f7365637265745f6b65795f32303234',
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || 'your-telegram-bot-token-here',
    ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'ntrom4862',
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin123',
    ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@miningsim.com',
    
    VIP_LEVELS: {
        0: { 
            name: 'Bronze', 
            price: 0, 
            features: ['Basic Mining', '5% Withdrawal Fee', '10 TRX Min Withdrawal', '5% Referral Bonus'],
            color: 'bronze'
        },
        1: { 
            name: 'Silver', 
            price: 100, 
            features: ['All Bronze Features', '3% Withdrawal Fee', '5 TRX Min Withdrawal', '8% Referral Bonus', 'Priority Support'],
            color: 'silver'
        },
        2: { 
            name: 'Gold', 
            price: 500, 
            features: ['All Silver Features', '1% Withdrawal Fee', '1 TRX Min Withdrawal', '12% Referral Bonus', 'VIP Support', 'Early Access'],
            color: 'gold'
        }
    },
    
    MACHINES: [
        { 
            id: 1, 
            name: 'Basic Miner', 
            hashrate: 100, 
            price: 50, 
            power: 10,
            maintenance: 5,
            vip_requirement: 0,
            description: 'Perfect for beginners'
        },
        { 
            id: 2, 
            name: 'Advanced Miner', 
            hashrate: 500, 
            price: 200, 
            power: 45,
            maintenance: 20,
            vip_requirement: 1,
            description: 'For serious miners'
        },
        { 
            id: 3, 
            name: 'Pro Miner', 
            hashrate: 2000, 
            price: 800, 
            power: 180,
            maintenance: 50,
            vip_requirement: 2,
            description: 'Maximum earning potential'
        }
    ]
};