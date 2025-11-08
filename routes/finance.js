const express = require('express');
const router = express.Router();
const { Finance, Transaction, User, Investment } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimit');
const AESEncryption = require('../utils/encryption');

// Bakiye bilgileri
router.get('/balance', authenticateToken, apiLimiter, async (req, res) => {
    try {
        const userId = req.user.userId;

        const finance = await Finance.findOne({ user_id: userId });

        res.json({
            success: true,
            balance: finance || {
                total_balance: 0,
                locked_balance: 0,
                available_balance: 0
            }
        });

    } catch (error) {
        console.error('Balance error:', error);
        res.status(500).json({
            success: false,
            message: 'Database error'
        });
    }
});

// Transaction geçmişi
router.get('/transactions', authenticateToken, apiLimiter, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        const [transactions, totalCount] = await Promise.all([
            Transaction.find({
                $or: [{ sender_id: userId }, { receiver_id: userId }]
            })
            .populate('sender_id', 'username')
            .populate('receiver_id', 'username')
            .sort({ date: -1 })
            .skip(offset)
            .limit(parseInt(limit)),
            Transaction.countDocuments({
                $or: [{ sender_id: userId }, { receiver_id: userId }]
            })
        ]);

        res.json({
            success: true,
            transactions: transactions || [],
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalCount,
                pages: Math.ceil(totalCount / limit)
            }
        });

    } catch (error) {
        console.error('Transactions error:', error);
        res.status(500).json({
            success: false,
            message: 'Database error'
        });
    }
});

// Para çekme talebi
router.post('/withdraw', authenticateToken, apiLimiter, async (req, res) => {
    const session = await Finance.startSession();
    session.startTransaction();

    try {
        const userId = req.user.userId;
        const { amount, pay_password, wallet_address } = req.body;

        if (!amount || !pay_password || !wallet_address) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: 'Amount, payment password and wallet address are required'
            });
        }

        if (amount <= 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: 'Amount must be positive'
            });
        }

        // Kullanıcı ve finance bilgilerini al
        const [user, finance] = await Promise.all([
            User.findOne({ _id: userId }).session(session),
            Finance.findOne({ user_id: userId }).session(session)
        ]);

        if (!user || !finance) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: 'User or finance record not found'
            });
        }

        // Payment password kontrolü
        const isPayPasswordValid = AESEncryption.comparePayPassword(pay_password, user.pay_password);
        if (!isPayPasswordValid) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: 'Invalid payment password'
            });
        }

        // Minimum çekim miktarı kontrolü
        const minWithdrawal = user.vip_level === 0 ? 10 : user.vip_level === 1 ? 5 : 1;
        if (amount < minWithdrawal) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: `Minimum withdrawal amount is ${minWithdrawal} TRX`
            });
        }

        // Bakiye kontrolü
        if (finance.available_balance < amount) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: 'Insufficient balance'
            });
        }

        // Çekim ücreti hesaplama
        let feePercentage = 0.05; // %5
        if (user.vip_level === 1) feePercentage = 0.03; // %3
        if (user.vip_level === 2) feePercentage = 0.01; // %1

        const fee = amount * feePercentage;
        const netAmount = amount - fee;

        // Bakiyeyi güncelle
        await Finance.updateOne(
            { user_id: userId },
            { 
                $inc: { 
                    available_balance: -amount,
                    total_balance: -amount
                },
                updated_at: new Date()
            },
            { session }
        );

        // Transaction kaydı oluştur
        const transaction = new Transaction({
            sender_id: userId,
            receiver_id: null,
            amount: -amount,
            fee: fee,
            transaction_type: 'withdrawal',
            status: 'pending'
        });
        await transaction.save({ session });

        // Transaction'ı commit et
        await session.commitTransaction();
        session.endSession();

        res.json({
            success: true,
            message: 'Withdrawal request submitted successfully',
            transaction: {
                amount: netAmount,
                fee: fee,
                total: amount
            }
        });

    } catch (error) {
        // Hata durumunda rollback
        await session.abortTransaction();
        session.endSession();
        
        console.error('Withdrawal error:', error);
        res.status(500).json({
            success: false,
            message: 'Withdrawal failed: ' + error.message
        });
    }
});

// Ödeme yöntemleri
router.get('/payment-methods', authenticateToken, apiLimiter, (req, res) => {
    const paymentMethods = [
        {
            id: 1,
            name: 'TRON (TRX)',
            symbol: 'TRX',
            network: 'TRON',
            min_deposit: 10,
            fee: 0
        }
    ];

    res.json({
        success: false,
        message: 'Payment methods endpoint is not implemented yet',
        methods: paymentMethods
    });
});

// Yeni investment endpoint'leri

// Aktif yatırımları getir
router.get('/active-investments', authenticateToken, apiLimiter, async (req, res) => {
    try {
        const userId = req.user.userId;

        const investments = await Investment.find({ 
            user_id: userId, 
            status: 'active' 
        }).sort({ start_date: -1 });

        res.json({
            success: true,
            investments: investments || []
        });

    } catch (error) {
        console.error('Active investments error:', error);
        res.status(500).json({
            success: false,
            message: 'Database error'
        });
    }
});

// Yatırım geçmişi
router.get('/investment-history', authenticateToken, apiLimiter, async (req, res) => {
    try {
        const userId = req.user.userId;

        const history = await Investment.find({ user_id: userId })
            .sort({ start_date: -1 })
            .limit(50);

        res.json({
            success: true,
            history: history || []
        });

    } catch (error) {
        console.error('Investment history error:', error);
        res.status(500).json({
            success: false,
            message: 'Database error'
        });
    }
});

// Yatırım istatistikleri
router.get('/investment-stats', authenticateToken, apiLimiter, async (req, res) => {
    try {
        const userId = req.user.userId;

        const stats = await Investment.aggregate([
            { $match: { user_id: userId, status: 'active' } },
            {
                $group: {
                    _id: null,
                    active_plans: { $sum: 1 },
                    total_invested: { $sum: '$amount' }
                }
            }
        ]);

        const result = stats.length > 0 ? stats[0] : { active_plans: 0, total_invested: 0 };

        res.json({
            success: true,
            stats: result
        });

    } catch (error) {
        console.error('Investment stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Database error'
        });
    }
});

// Yatırım yapma
router.post('/invest', authenticateToken, apiLimiter, async (req, res) => {
    const session = await Finance.startSession();
    session.startTransaction();

    try {
        const userId = req.user.userId;
        const { plan, amount, pay_password } = req.body;

        if (!plan || !amount || !pay_password) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: 'Plan, amount and payment password are required'
            });
        }

        if (amount <= 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: 'Amount must be positive'
            });
        }

        // Plan validation
        const planConfigs = {
            basic: { minAmount: 10, dailyReturn: 1.5, period: 30 },
            advanced: { minAmount: 100, dailyReturn: 2.0, period: 60 },
            premium: { minAmount: 500, dailyReturn: 2.5, period: 90 }
        };

        const planConfig = planConfigs[plan];
        if (!planConfig) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: 'Invalid investment plan'
            });
        }

        if (amount < planConfig.minAmount) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: `Minimum investment for ${plan} plan is ${planConfig.minAmount} TRX`
            });
        }

        // Kullanıcı ve finance bilgilerini al
        const [user, finance] = await Promise.all([
            User.findOne({ _id: userId }).session(session),
            Finance.findOne({ user_id: userId }).session(session)
        ]);

        if (!user || !finance) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: 'User or finance record not found'
            });
        }

        // Payment password kontrolü
        const isPayPasswordValid = AESEncryption.comparePayPassword(pay_password, user.pay_password);
        if (!isPayPasswordValid) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: 'Invalid payment password'
            });
        }

        // Bakiye kontrolü
        if (finance.available_balance < amount) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: 'Insufficient balance'
            });
        }

        // Yatırım detaylarını hesapla
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(startDate.getDate() + planConfig.period);
        const expectedTotal = amount + (amount * (planConfig.dailyReturn / 100) * planConfig.period);

        // Bakiyeyi güncelle
        await Finance.updateOne(
            { user_id: userId },
            { 
                $inc: { 
                    available_balance: -amount,
                    locked_balance: amount
                },
                updated_at: new Date()
            },
            { session }
        );

        // Yatırım kaydı oluştur
        const investment = new Investment({
            user_id: userId,
            plan_name: plan,
            amount: amount,
            daily_return: planConfig.dailyReturn,
            contract_period: planConfig.period,
            start_date: startDate,
            end_date: endDate,
            expected_total: expectedTotal,
            status: 'active'
        });
        await investment.save({ session });

        // Transaction kaydı oluştur
        const transaction = new Transaction({
            sender_id: userId,
            receiver_id: null,
            amount: -amount,
            transaction_type: 'investment',
            status: 'completed'
        });
        await transaction.save({ session });

        // Transaction'ı commit et
        await session.commitTransaction();
        session.endSession();

        res.json({
            success: true,
            message: 'Investment successful!',
            investment: {
                plan_name: plan,
                amount: amount,
                daily_return: planConfig.dailyReturn,
                contract_period: planConfig.period,
                expected_total: expectedTotal
            }
        });

    } catch (error) {
        // Hata durumunda rollback
        await session.abortTransaction();
        session.endSession();
        
        console.error('Investment error:', error);
        res.status(500).json({
            success: false,
            message: 'Investment failed: ' + error.message
        });
    }
});

module.exports = router;