const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB connection string - .env dosyasından al veya default kullan
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mining_bot';

class Database {
    constructor() {
        this.isConnected = false;
        this.connect();
    }

    async connect() {
        try {
            await mongoose.connect(MONGODB_URI, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
            });
            
            this.isConnected = true;
            console.log('✅ Connected to MongoDB successfully');
            
            // Modelleri otomatik olarak kaydet
            this.registerModels();
            
        } catch (error) {
            console.error('❌ MongoDB connection error:', error.message);
            setTimeout(() => this.connect(), 5000); // 5 saniye sonra tekrar dene
        }
    }

    registerModels() {
        // Modeller burada require edilebilir
        console.log('📊 MongoDB models registered');
    }

    async disconnect() {
        if (this.isConnected) {
            await mongoose.disconnect();
            this.isConnected = false;
            console.log('📴 Disconnected from MongoDB');
        }
    }
}

// MongoDB Schema Definitions
const userSchema = new mongoose.Schema({
    tg_username: { type: String },
    tg_verified: { type: Boolean, default: false },
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    vip_level: { type: Number, default: 0 },
    ref_code: { type: String, unique: true },
    password: { type: String, required: true },
    pay_password: { type: String, required: true },
    ref_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, default: 'active' }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

const financeSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    total_balance: { type: Number, default: 0 },
    locked_balance: { type: Number, default: 0 },
    available_balance: { type: Number, default: 0 },
    total_earned: { type: Number, default: 0 },
    total_withdrawn: { type: Number, default: 0 }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

const walletSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    wallet_address: { type: String },
    deposit_address: { type: String },
    dp_add_prvkey: { type: String }
}, {
    timestamps: { createdAt: 'created_at' }
});

const machineSchema = new mongoose.Schema({
    machine_name: { type: String, required: true },
    hashrate: { type: Number, required: true },
    price: { type: Number, required: true },
    power_consumption: { type: Number },
    maintenance_cost: { type: Number, default: 0 },
    vip_requirement: { type: Number, default: 0 },
    stock: { type: Number, default: -1 },
    status: { type: String, default: 'active' }
});

const miningSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    machine_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Machine', required: true },
    hashrate: { type: Number, required: true },
    amount: { type: Number, required: true },
    start_time: { type: Date, default: Date.now },
    end_time: { type: Date },
    total_earning: { type: Number, default: 0 },
    daily_earning: { type: Number, default: 0 },
    status: { type: String, default: 'active' }
});

const vipSchema = new mongoose.Schema({
    vip_level: { type: Number, unique: true, required: true },
    vip_name: { type: String, required: true },
    vip_price: { type: Number, required: true },
    vip_features: { type: String },
    vip_duration: { type: Number, default: 30 },
    withdrawal_fee: { type: Number, default: 5.00 },
    min_withdrawal: { type: Number, default: 10.00 },
    referral_bonus: { type: Number, default: 5.00 }
});

const referralSchema = new mongoose.Schema({
    referrer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    referred_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    earned_amount: { type: Number, default: 0 }
}, {
    timestamps: { createdAt: 'created_at' }
});

const transactionSchema = new mongoose.Schema({
    sender_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    receiver_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    fee: { type: Number, default: 0 },
    transaction_type: { type: String, required: true },
    status: { type: String, default: 'pending' }
}, {
    timestamps: { createdAt: 'date' }
});

const investmentSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    plan_name: { type: String, required: true },
    amount: { type: Number, required: true },
    daily_return: { type: Number, required: true },
    contract_period: { type: Number, required: true },
    start_date: { type: Date, required: true },
    end_date: { type: Date, required: true },
    total_earned: { type: Number, default: 0 },
    expected_total: { type: Number, required: true },
    status: { type: String, default: 'active' }
}, {
    timestamps: { createdAt: 'created_at' }
});

// MongoDB Models
const User = mongoose.model('User', userSchema);
const Finance = mongoose.model('Finance', financeSchema);
const Wallet = mongoose.model('Wallet', walletSchema);
const Machine = mongoose.model('Machine', machineSchema);
const Mining = mongoose.model('Mining', miningSchema);
const VIP = mongoose.model('VIP', vipSchema);
const Referral = mongoose.model('Referral', referralSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);
const Investment = mongoose.model('Investment', investmentSchema);

// Default verileri ekleme fonksiyonu
async function initializeDefaultData() {
    try {
        // Makineleri kontrol et
        const machineCount = await Machine.countDocuments();
        if (machineCount === 0) {
            console.log('🔄 Adding default machines to MongoDB...');
            await Machine.insertMany([
                {
                    machine_name: 'Basic Miner',
                    hashrate: 100,
                    price: 10,
                    power_consumption: 10,
                    maintenance_cost: 1,
                    vip_requirement: 0,
                    stock: -1
                },
                {
                    machine_name: 'Advanced Miner',
                    hashrate: 500,
                    price: 50,
                    power_consumption: 45,
                    maintenance_cost: 5,
                    vip_requirement: 1,
                    stock: -1
                },
                {
                    machine_name: 'Pro Miner',
                    hashrate: 2000,
                    price: 200,
                    power_consumption: 180,
                    maintenance_cost: 20,
                    vip_requirement: 2,
                    stock: -1
                }
            ]);
            console.log('✅ Default machines inserted');
        }

        // VIP seviyelerini kontrol et
        const vipCount = await VIP.countDocuments();
        if (vipCount === 0) {
            console.log('🔄 Adding VIP levels to MongoDB...');
            await VIP.insertMany([
                {
                    vip_level: 0,
                    vip_name: 'Bronze',
                    vip_price: 0,
                    vip_features: 'Basic Mining Access, 5% Withdrawal Fee, 10 TRX Min Withdrawal, 5% Referral Bonus',
                    vip_duration: 30,
                    withdrawal_fee: 5.00,
                    min_withdrawal: 10.00,
                    referral_bonus: 5.00
                },
                {
                    vip_level: 1,
                    vip_name: 'Silver',
                    vip_price: 100,
                    vip_features: 'Faster Withdrawals, Priority Support, 3% Withdrawal Fee, 5 TRX Min Withdrawal, 8% Referral Bonus',
                    vip_duration: 30,
                    withdrawal_fee: 3.00,
                    min_withdrawal: 5.00,
                    referral_bonus: 8.00
                },
                {
                    vip_level: 2,
                    vip_name: 'Gold',
                    vip_price: 500,
                    vip_features: 'All Features, Maximum Rewards, 1% Withdrawal Fee, 1 TRX Min Withdrawal, 12% Referral Bonus, VIP Support',
                    vip_duration: 30,
                    withdrawal_fee: 1.00,
                    min_withdrawal: 1.00,
                    referral_bonus: 12.00
                }
            ]);
            console.log('✅ VIP levels inserted');
        }

    } catch (error) {
        console.error('❌ Default data initialization error:', error);
    }
}

// Bağlantı event handlers
mongoose.connection.on('connected', () => {
    console.log('📊 MongoDB connection established');
    initializeDefaultData();
});

mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('⚠️ MongoDB connection disconnected');
});

// Graceful shutdown
process.on('SIGINT', async () => {
    await mongoose.connection.close();
    console.log('📴 MongoDB connection closed through app termination');
    process.exit(0);
});

// Database instance oluştur
const database = new Database();

// Export models and connection
module.exports = {
    connection: mongoose.connection,
    User,
    Finance,
    Wallet,
    Machine,
    Mining,
    VIP,
    Referral,
    Transaction,
    Investment,
    db: mongoose.connection // Backward compatibility için
};